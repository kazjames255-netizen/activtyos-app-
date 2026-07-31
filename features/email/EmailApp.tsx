"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import type { SavedImage } from "@/lib/settings";
import { composeMomentImage, resolveSavedText, triggerDownload } from "@/lib/momentImage";
import { Badge, Card, FieldLabel, Input, Select } from "@/components/ui";
import { OperatorPage, TabStrip } from "@/components/OperatorPage";
import { MERGE_FIELDS } from "@/lib/merge-fields";
import type { TenantSettings } from "@/lib/settings";
import { downscaleImage, type Company, type Newsletter } from "@/features/newsfeed/newsletter";
import { CampaignDesigner, renderDesignHtml, renderDesignText, loadMyTemplates, persistMyTemplates, type CampaignDesign, type Block, type SavedTemplate, type Social } from "@/features/email/campaignTemplates";

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

// Turn the composer's light markdown (# heading, **bold**, _italic_, [text](url),
// line breaks) into safe HTML so the formatting actually renders in the sent email.
function mdToHtml(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc(src)
    .replace(/^# (.*)$/gm, '<h3 style="margin:0 0 8px">$1</h3>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/_([^_]+)_/g, "<i>$1</i>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, "<br>");
}
// HTML (from the rich editor) → a plain-text fallback for the stored body.
function htmlToText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li)>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
}
// A small WYSIWYG editor — Bold/Heading/Italic/List/Link format the text LIVE
// (contentEditable), and the value is HTML that's emailed as-is.
function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const selImg = useRef<HTMLImageElement | null>(null);
  const [imgW, setImgW] = useState(100);          // width % of the targeted image
  const hasImg = /<img/i.test(value);
  // The image the size bar controls: the last-clicked one, else the last in the body.
  const targetImg = (): HTMLImageElement | null => { const el = ref.current; if (!el) return null; if (selImg.current && el.contains(selImg.current)) return selImg.current; const imgs = el.querySelectorAll("img"); return imgs.length ? (imgs[imgs.length - 1] as HTMLImageElement) : null; };
  useEffect(() => { const el = ref.current; if (el && el.innerHTML !== value) { el.innerHTML = value; selImg.current = null; } }, [value]);
  const cmd = (c: string, arg?: string) => { ref.current?.focus(); document.execCommand(c, false, arg); if (ref.current) onChange(ref.current.innerHTML); };
  const pickImg = (e: React.MouseEvent) => { const t = e.target as HTMLElement; if (t.tagName === "IMG") { const img = t as HTMLImageElement; selImg.current = img; setImgW(parseInt(img.style.width) || 100); } };
  const sizeImg = (w: number) => { const img = targetImg(); if (!img) return; selImg.current = img; const cw = Math.min(100, Math.max(10, Math.round(w))); img.style.width = `${cw}%`; img.style.height = "auto"; setImgW(cw); if (ref.current) onChange(ref.current.innerHTML); };
  const btn = "rounded px-2 py-1 text-[13px] text-[var(--ink-2)] hover:bg-white";
  const sep = <span className="mx-0.5 h-4 w-px bg-[var(--line)]" />;
  // [command, arg, title, label, extraClass] — plain <button>s (no inline components).
  const tools: [string, string | undefined, string, string, string][] = [
    ["formatBlock", "H3", "Heading", "Aa", "font-extrabold"], ["|", undefined, "", "", ""],
    ["bold", undefined, "Bold", "B", "font-extrabold"], ["italic", undefined, "Italic", "I", "italic"], ["underline", undefined, "Underline", "U", "underline"], ["strikeThrough", undefined, "Strikethrough", "S", "line-through"], ["color", undefined, "", "", ""], ["|", undefined, "", "", ""],
    ["justifyLeft", undefined, "Align left", "⯇", ""], ["justifyCenter", undefined, "Align centre", "≡", ""], ["justifyRight", undefined, "Align right", "⯈", ""], ["|", undefined, "", "", ""],
    ["insertOrderedList", undefined, "Numbered list", "1.", ""], ["insertUnorderedList", undefined, "Bullet list", "•", ""], ["outdent", undefined, "Decrease indent", "⇤", ""], ["indent", undefined, "Increase indent", "⇥", ""], ["formatBlock", "blockquote", "Quote", "❝", ""], ["|", undefined, "", "", ""],
    ["link", undefined, "Insert link", "🔗", ""], ["removeFormat", undefined, "Clear formatting", "🧹", ""],
  ];
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-[var(--line)] bg-[var(--panel)] px-2 py-1.5">
        {tools.map(([c, arg, title, label, cls], i) => {
          if (c === "|") return <span key={i}>{sep}</span>;
          if (c === "color") return <label key={i} onMouseDown={(e) => e.preventDefault()} title="Text colour" className={`${btn} relative cursor-pointer font-extrabold`} style={{ color: "#2f6bd8" }}>A<input type="color" onChange={(e) => cmd("foreColor", e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label>;
          if (c === "link") return <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { const u = prompt("Link URL"); if (u) cmd("createLink", u); }} title={title} className={btn}>{label}</button>;
          return <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd(c, arg)} title={title} className={`${btn} ${cls}`}>{label}</button>;
        })}
      </div>
      {hasImg && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#dbe6fb] bg-[#f4f8ff] px-3 py-2">
          <span className="flex-none text-[11.5px] font-extrabold text-[#1d3a8f]">🖼 Photo size</span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeImg(imgW - 5)} className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[#dbe6fb] bg-white text-[15px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">−</button>
          <input type="range" min={10} max={100} step={1} value={imgW} onChange={(e) => sizeImg(Number(e.target.value))} className="h-1.5 min-w-[120px] flex-1 accent-[#2f6bd8]" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeImg(imgW + 5)} className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[#dbe6fb] bg-white text-[15px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">+</button>
          <span className="w-10 flex-none text-right text-[12px] font-extrabold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{imgW}%</span>
          <div className="mx-1 h-4 w-px flex-none bg-[#dbe6fb]" />
          {([["S", 30], ["M", 60], ["L", 100]] as const).map(([l, w]) => <button key={l} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeImg(w)} className="flex-none rounded-md border border-[#dbe6fb] bg-white px-2 py-0.5 text-[11px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">{l}</button>)}
        </div>
      )}
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        onClick={pickImg}
        className="min-h-[180px] px-3 py-2.5 text-[13px] leading-relaxed outline-none [&_a]:text-[#1d3a8f] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--line)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--ink-3)] [&_h3]:mb-1 [&_h3]:text-[16px] [&_h3]:font-extrabold [&_img]:cursor-pointer [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5" />
      {hasImg && <div className="rounded-b-lg border-t border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-[10.5px] text-[var(--ink-3)]">💡 The slider above resizes your photo. With more than one, click the one you want first.</div>}
    </div>
  );
}
interface Sent { id: string; subject: string; audience: string; recipientCount: number; sentByName?: string; createdAt?: string; status?: "sending" | "sent"; delivered?: number; openedBy?: string[] }
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
          <button type="button" onClick={onRemove} className="rounded-md border border-[#f6c9cc] px-2 py-1 text-[11px] font-bold text-[#c02636] hover:bg-[#fdebec]" title="Delete this photo from your Email library">🗑</button>
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
  enquiry: { bg: "#e4edfd", fg: "#1d3a8f", text: "Potential customer" },
  system: { bg: "var(--panel)", fg: "var(--ink-2)", text: "System" },
};
type MailFolder = "inbox" | "sent" | "drafts" | "scheduled" | "spam" | "archive" | "snoozed" | "trash";
interface Mail { id: string; from: string; fromEmail?: string; to?: string; cc?: string[]; tag?: string; subject: string; preview: string; body?: string; time: string; unread?: boolean; starred?: boolean; thread?: boolean; labels?: LabelTone[]; attachment?: string; attachmentSize?: string; quickReplies?: string[]; folder?: MailFolder; schedId?: string }

// A received message as the API stores it (see server routes/emails.ts —
// `emailMessages`, filled by the inbound webhook).
interface ServerMail { id: string; from: string; fromEmail?: string; to?: string; subject: string; body?: string; html?: string; labels?: string[]; attachments?: { name: string; size?: string }[]; unread?: boolean; starred?: boolean; snoozedUntil?: string | null; folder?: string; at?: string }
// A queued send (POST /api/emails/schedule) waiting for its sendAt.
interface Scheduled { id: string; subject: string; body?: string; recipientCount: number; sendAt: string; status: "scheduled" | "sent" | "cancelled"; emailId?: string }

const KNOWN_LABELS = new Set<string>(["urgent", "follow", "haf", "enquiry", "system"]);
const toMail = (m: ServerMail): Mail => ({
  id: m.id,
  from: m.from,
  fromEmail: m.fromEmail,
  to: m.to,
  subject: m.subject,
  preview: (m.body ?? "").replace(/\s+/g, " ").slice(0, 120),
  body: m.body,
  time: when(m.at),
  unread: m.unread,
  starred: m.starred,
  labels: (m.labels ?? []).filter((l): l is LabelTone => KNOWN_LABELS.has(l)),
  attachment: m.attachments?.[0]?.name,
  attachmentSize: m.attachments?.[0]?.size,
  folder: (["inbox", "archive", "snoozed", "spam", "trash"].includes(m.folder ?? "") ? m.folder : "inbox") as MailFolder,
});
// Demo inbox — shown only when the real inbox is empty, so the enquiry flow can be tried end-to-end.
const DEMO_INBOX: ServerMail[] = [
  { id: "demo-1", from: "Sarah Thompson", fromEmail: "sarah.thompson@gmail.com", subject: "Summer camp availability?", body: "Hi, do you have any spaces left on your summer multi-activity camp in August? My daughter is 8. Thanks, Sarah", unread: true, folder: "inbox", at: "2026-07-31T08:42:00Z" },
  { id: "demo-2", from: "James Patel", fromEmail: "j.patel@outlook.com", subject: "After-school football", body: "Hello — I'm interested in the after-school football club in Milton Keynes for my two boys. What days does it run and how much is it? Cheers, James", unread: true, folder: "inbox", at: "2026-07-31T07:15:00Z" },
  { id: "demo-3", from: "Emma Wilson", fromEmail: "emmawilson88@icloud.com", subject: "Holiday club prices", body: "Could you send me a price list for the October holiday club please? Do you offer sibling discounts? Emma", unread: false, labels: ["enquiry"], folder: "inbox", at: "2026-07-30T16:20:00Z" },
  { id: "demo-4", from: "Tom Harris", fromEmail: "tomharris.mk@gmail.com", subject: "Two children — any spaces?", body: "Hi there, we've just moved to Aylesbury and I'm looking for holiday cover for my 6 and 9 year old. Do you have space and what are your hours? Tom", unread: true, folder: "inbox", at: "2026-07-30T11:03:00Z" },
  { id: "demo-5", from: "Priya Shah", fromEmail: "priya.shah@gmail.com", subject: "SEN support question", body: "Hello, my son has additional needs (ASD) — are your camps able to support him, and do you have 1:1 options? Thank you, Priya", unread: true, folder: "inbox", at: "2026-07-29T18:47:00Z" },
];
// "Sends Fri 1 Aug, 09:00" — sendAt is a local datetime string, not ISO+tz.
const whenSched = (sendAt: string) => new Date(sendAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const FOLDERS: [string, string][] = [
  ["inbox", "Inbox"], ["starred", "Starred"], ["snoozed", "Snoozed"], ["sent", "Sent"],
  ["drafts", "Drafts"], ["scheduled", "Scheduled"], ["archive", "Archive"], ["spam", "Spam"], ["trash", "Trash"], ["all", "All mail"],
];

function InboxView({ onCompose, onReply, onForward, onQuickReply, onEnquiry, history, locations, messages, scheduled, onRefresh }: { onCompose: () => void; onReply: (m: Mail) => void; onForward: (m: Mail) => void; onQuickReply: (m: Mail, text: string) => void; onEnquiry: (m: Mail, locations: string[]) => void; history: Sent[] | null; locations: string[]; messages: ServerMail[] | null; scheduled: Scheduled[] | null; onRefresh: () => void }) {
  const [enqFor, setEnqFor] = useState<Mail | null>(null);
  const [enqLocs, setEnqLocs] = useState<string[]>([]);
  // Server messages, patched optimistically — the realtime refresh reconciles.
  const [items, setItems] = useState<Mail[]>([]);
  useEffect(() => { setItems((messages ?? []).map(toMail)); }, [messages]);
  const [folder, setFolder] = useState("inbox");
  const [filter, setFilter] = useState<"all" | "unread" | "starred" | "files">("all");
  const [density, setDensity] = useState<"cozy" | "compact">("cozy");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Mail | null>(null);
  const [showContact, setShowContact] = useState(false);

  // A row is a real stored message unless it's a derived Sent/Scheduled one.
  const isMsg = (id: string) => !id.startsWith("sent-") && !id.startsWith("sch-");
  const persist = (id: string, p: Record<string, unknown>) => { if (isMsg(id)) void api(`/api/emails/messages/${id}`, { method: "PATCH", body: JSON.stringify(p) }).catch(() => onRefresh()); };
  const patch = (id: string, p: Partial<Mail>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const drop = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));
  const move = (m: Mail, f: MailFolder) => { patch(m.id, { folder: f }); persist(m.id, { folder: f }); setOpen(null); };
  const openMail = (m: Mail) => { if (m.unread) { patch(m.id, { unread: false }); persist(m.id, { unread: false }); } setOpen(m); };
  const star = (m: Mail) => { patch(m.id, { starred: !m.starred }); persist(m.id, { starred: !m.starred }); };
  const archive = (m: Mail) => move(m, "archive");
  // Snooze = hide until tomorrow 08:00; the server wakes it back into the inbox.
  const snooze = (m: Mail) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); patch(m.id, { folder: "snoozed" }); persist(m.id, { snoozedUntil: d.toISOString() }); setOpen(null); };
  const spam = (m: Mail) => move(m, "spam");
  const restore = (m: Mail) => { patch(m.id, { folder: "inbox" }); persist(m.id, { folder: "inbox", snoozedUntil: null }); setOpen(null); };
  // First delete → Trash (recoverable). Deleting from Trash removes it for good.
  const del = (m: Mail) => { if ((m.folder ?? "inbox") === "trash") { drop(m.id); if (isMsg(m.id)) void api(`/api/emails/messages/${m.id}`, { method: "DELETE" }).catch(() => onRefresh()); setOpen(null); } else move(m, "trash"); };
  const cancelScheduled = (m: Mail) => { if (!m.schedId || !confirm(`Cancel the scheduled send "${m.subject}"?`)) return; void api(`/api/emails/scheduled/${m.schedId}`, { method: "DELETE" }).then(() => onRefresh()).catch(() => onRefresh()); setOpen(null); };
  const reply = (m: Mail) => { setOpen(null); onReply(m); };
  const forward = (m: Mail) => { setOpen(null); onForward(m); };
  const markUnread = (m: Mail) => { patch(m.id, { unread: true }); persist(m.id, { unread: true }); setOpen(null); };
  const quickReply = (m: Mail, text: string) => { setOpen(null); onQuickReply(m, text); };

  // Real sent history shows in the Sent folder as mail rows.
  const sentMail: Mail[] = (history ?? []).map((h) => ({ id: `sent-${h.id}`, from: "You", subject: h.subject, preview: h.audience === "one" ? "Sent to 1 address" : `Sent to ${h.recipientCount} families`, time: when(h.createdAt), folder: "sent" }));
  // The server-side scheduled queue shows in Scheduled, cancellable until it fires.
  const schedMail: Mail[] = (scheduled ?? []).filter((s) => s.status === "scheduled").map((s) => ({ id: `sch-${s.id}`, schedId: s.id, from: "You", subject: s.subject, preview: `Sends ${whenSched(s.sendAt)} · to ${s.recipientCount} recipient${s.recipientCount === 1 ? "" : "s"}`, body: s.body, time: whenSched(s.sendAt), folder: "scheduled" }));
  const pool = folder === "sent" ? sentMail : folder === "scheduled" ? schedMail : items;
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
  const count = (k: string) => k === "sent" ? sentMail.length : k === "scheduled" ? schedMail.length || undefined : k === "inbox" ? items.filter((m) => (m.folder ?? "inbox") === "inbox" && m.unread).length
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
          {list.length === 0 ? <div className="px-4 py-14 text-center text-[13px] text-[var(--ink-3)]">{folder === "inbox" && !items.length ? "No mail yet. Email sent to your connected address lands here — sends and replies still work from Compose." : "Nothing here."}</div>
          : list.map((m) => (
            <div key={m.id} className={`flex w-full items-center gap-3 border-b border-[var(--line)] px-3 last:border-0 hover:bg-[#f7faff] ${pad}`} style={m.unread ? { background: "#f2f7ff" } : undefined}>
              <span className="flex-none" style={{ width: 6 }}>{m.unread && <span className="block h-2 w-2 rounded-full" style={{ background: "#2f6bd8" }} />}</span>
              <button type="button" onClick={() => star(m)} className="flex-none text-[15px]" style={{ color: m.starred ? "#f4b400" : "var(--ink-3)" }} aria-label={m.starred ? "Unstar" : "Star"}>{m.starred ? "★" : "☆"}</button>
              <button type="button" onClick={() => openMail(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className={`w-[140px] flex-none truncate text-[13.5px] ${m.unread ? "font-extrabold text-[var(--ink)]" : "font-normal text-[var(--ink-2)]"}`}>{m.from}{m.thread && <span className="text-[var(--ink-3)]"> »</span>}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]"><span className={m.unread ? "font-extrabold text-[var(--ink)]" : "font-normal text-[var(--ink-2)]"}>{m.subject}</span> <span className="text-[var(--ink-3)]">— {m.preview}</span></span>
                {m.labels?.map((l) => <span key={l} className="flex-none rounded-md px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: LABEL_STYLE[l].bg, color: LABEL_STYLE[l].fg }}>{LABEL_STYLE[l].text}</span>)}
                {m.attachment && <span className="flex-none text-[13px] text-[var(--ink-3)]" title={m.attachment}>📎</span>}
                <span className="flex-none text-[12px] font-semibold text-[var(--ink-3)]">{m.time}</span>
              </button>
              {folder === "sent" ? null : folder === "scheduled" ? (
                <button type="button" onClick={() => cancelScheduled(m)} className="flex-none rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-3)] hover:border-[#e2b4b8] hover:text-[#c02636]" title="Cancel this scheduled send">✕ Cancel</button>
              ) : restorable ? <>
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
      <div className="mt-3 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] px-3 py-2 text-[11.5px] text-[#1d3a8f]">Star, read, folders, snooze and delete are saved to your account. Sent shows your real send history; Scheduled shows queued sends you can still cancel. Receiving mail here needs your mailbox forwarded to ActivityOS (ask support to connect it).</div>
      {open && (() => { const o = open; const initials = o.from.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        const toolBtn = "flex-none rounded-full border border-[#dbe6fb] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#2a3a63] shadow-[0_1px_2px_rgba(20,40,90,.06)] transition-colors hover:border-[#2f6bd8] hover:text-[#1d3a8f]";
        return (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#0b1730]/50 p-4 pt-[5vh] backdrop-blur-[2px]" onClick={() => setOpen(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#16306e]/10" onClick={(e) => e.stopPropagation()}>
            {/* blue gradient header */}
            <div className="px-6 py-4 text-white" style={{ background: "radial-gradient(120% 160% at 8% -30%, #4f8bf5 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#2f6bd8 100%)" }}>
              <div className="flex items-start gap-2">
                <span className="text-[19px] font-extrabold leading-snug" style={{ fontFamily: "var(--ff-display)" }}>{o.subject}</span>
                <button type="button" onClick={() => setOpen(null)} className="ml-auto flex h-7 w-7 flex-none items-center justify-center rounded-full text-[16px] text-white/85 hover:bg-white/20">×</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">{o.labels?.map((l) => <span key={l} className="rounded-md px-2 py-0.5 text-[11px] font-extrabold" style={{ background: LABEL_STYLE[l].bg, color: LABEL_STYLE[l].fg }}>{LABEL_STYLE[l].text}</span>)}{o.tag && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white/90">🏷 {o.tag}</span>}</div>
            </div>
            {/* toolbar — file/flag actions only exist for real stored messages */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[#f5f8fd] px-4 py-2.5">
              <button type="button" onClick={() => setOpen(null)} className={toolBtn}>← Back</button>
              {o.folder === "scheduled" && <button type="button" onClick={() => cancelScheduled(o)} className="flex-none rounded-full border border-[#dbe6fb] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#2a3a63] shadow-[0_1px_2px_rgba(20,40,90,.06)] transition-colors hover:border-[#e2b4b8] hover:text-[#c02636]">✕ Cancel send</button>}
              {isMsg(o.id) && <>
                {o.folder && o.folder !== "inbox"
                  ? <button type="button" onClick={() => restore(o)} className={toolBtn}>↩ Move to Inbox</button>
                  : <button type="button" onClick={() => archive(o)} className={toolBtn}>🗄 Archive</button>}
                <button type="button" onClick={() => snooze(o)} className={toolBtn} title="Hide it until later — it comes back tomorrow morning">⏰ Snooze</button>
                <button type="button" onClick={() => markUnread(o)} className={toolBtn}>✉ Unread</button>
                <button type="button" onClick={() => spam(o)} className={toolBtn}>⊘ Spam</button>
                <button type="button" onClick={() => del(o)} className="flex-none rounded-full border border-[#dbe6fb] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#2a3a63] shadow-[0_1px_2px_rgba(20,40,90,.06)] transition-colors hover:border-[#e2b4b8] hover:text-[#c02636]">🗑 {o.folder === "trash" ? "Delete forever" : "Delete"}</button>
              </>}
              <button type="button" onClick={() => setShowContact((v) => !v)} className={`${toolBtn} ml-auto`} title="Show this sender's contact card">◐ Contact</button>
            </div>
            {/* message */}
            <div className="px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-white shadow-[0_2px_6px_rgba(47,107,216,.35)]" style={{ background: "linear-gradient(135deg,#3f78d8,#16306e)" }}>{initials}</span>
                <div className="min-w-0 flex-1"><div className="text-[14.5px] font-extrabold text-[var(--ink)]">{o.from}</div><div className="text-[12.5px] text-[var(--ink-3)]">{o.fromEmail}{o.to ? ` · to ${o.to}` : ""}{o.cc?.length ? `, +${o.cc.length}` : ""}</div></div>
                <span className="flex-none text-[12.5px] font-semibold text-[var(--ink-3)]">{o.time}</span>
              </div>
              {showContact && <div className="mt-3 rounded-xl border border-[#dbe6fb] bg-[#f4f8ff] p-3 text-[12.5px]"><div className="font-extrabold text-[#1d3a8f]">{o.from}</div><div className="text-[var(--ink-3)]">{o.fromEmail}</div>{o.tag && <div className="mt-1 text-[var(--ink-2)]">List: <b>{o.tag}</b></div>}<div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Full contact history opens in the CRM once linked (backend).</div></div>}
              <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-2)]">{o.body ?? o.preview}</p>
              {o.attachment && <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">📎 {o.attachment}{o.attachmentSize && <span className="font-normal text-[var(--ink-3)]">{o.attachmentSize}</span>}</div>}
            </div>
            {o.quickReplies?.length ? <div className="border-t border-[var(--line)] bg-[#fbfdff] px-6 py-3"><div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Quick replies</div><div className="flex flex-wrap gap-2">{o.quickReplies.map((qr) => <button key={qr} type="button" onClick={() => quickReply(o, qr)} className="rounded-full border border-[#dbe6fb] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#2a3a63] transition-colors hover:border-[#2f6bd8] hover:bg-[#eef4fd] hover:text-[#1d3a8f]">{qr}</button>)}</div></div> : null}
            {isMsg(o.id) && <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-6 py-3.5">
              <button type="button" onClick={() => reply(o)} className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white shadow-[0_3px_10px_-2px_rgba(47,107,216,.5)]" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>↩ Reply</button>
              {(o.cc?.length ?? 0) > 0 && <button type="button" onClick={() => reply(o)} className="rounded-lg border border-[#dbe6fb] px-4 py-2 text-[13px] font-bold text-[#2a3a63] hover:border-[#2f6bd8] hover:text-[#1d3a8f]">↩ Reply all</button>}
              <button type="button" onClick={() => forward(o)} className="rounded-lg border border-[#dbe6fb] px-4 py-2 text-[13px] font-bold text-[#2a3a63] hover:border-[#2f6bd8] hover:text-[#1d3a8f]">↪ Forward</button>
              <button type="button" onClick={() => { setEnqLocs([]); setEnqFor(o); }} className="ml-auto rounded-lg border border-[#bfe6cf] px-4 py-2 text-[13px] font-bold text-[#127a3e] hover:bg-[#eafaf0]" title="Add this sender to your New enquiries list">➕ Mark as enquiry</button>
            </div>}
          </div>
        </div>
      ); })()}
      {enqFor && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onClick={() => setEnqFor(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#16306e]/10" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-t-2xl px-5 py-4 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
              <div className="text-[15px] font-extrabold">Mark as enquiry</div>
              <div className="text-[12.5px] text-white/80">{enqFor.from} — which location are they interested in?</div>
            </div>
            <div className="p-5">
              <FieldLabel>Location{locations.length > 0 && <span className="ml-1 font-normal normal-case tracking-normal text-[var(--ink-3)]">— pick one or more</span>}</FieldLabel>
              {locations.length === 0
                ? <p className="text-[12.5px] text-[var(--ink-3)]">No venues on file yet — they&apos;ll be added with no specific location.</p>
                : <div className="flex flex-wrap gap-2">
                    {locations.map((l) => { const on = enqLocs.includes(l); return (
                      <button key={l} type="button" onClick={() => setEnqLocs((xs) => xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l])} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${on ? "bg-[#16306e] text-white shadow-sm" : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>{on ? "✓ " : ""}{l}</button>
                    ); })}
                  </div>}
              <p className="mt-2.5 text-[11.5px] text-[var(--ink-3)]">{enqLocs.length === 0 ? "None selected — they’ll be added with no specific location." : `They’ll appear on ${enqLocs.length} location board${enqLocs.length === 1 ? "" : "s"}.`} Drops off automatically once they book.</p>
              <div className="mt-5 flex items-center gap-2">
                {enqLocs.length > 0 && <button type="button" onClick={() => setEnqLocs([])} className="mr-auto text-[12px] font-bold text-[var(--ink-3)] hover:text-[#1d3a8f]">Clear</button>}
                <button type="button" onClick={() => setEnqFor(null)} className="ml-auto rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Cancel</button>
                <button type="button" onClick={() => { onEnquiry(enqFor, enqLocs); setEnqFor(null); setOpen(null); }} className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white shadow-sm" style={{ background: "linear-gradient(180deg,#33b06a,#127a3e)" }}>➕ Add to enquiries</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Campaigns + Audiences — a real marketing pipeline over the tenant's bookings.
// Audiences are built by FILTERING customers/bookings (current & previous listings,
// location, age group, dates); campaigns pick an audience + a saved Template and
// Send now / Schedule / Save draft. Campaigns + custom audiences persist locally
// (the true send/track/schedule engine is the backend — see the handoff doc).
interface Booking { id?: string; email?: string; name?: string; child?: string; age?: number; listingId?: string; title?: string; listingTitle?: string; locationName?: string; date?: string; dates?: string; createdAt?: string; method?: string }
interface AudFilter { location?: string; listingIds?: string[]; listingTitles?: string[]; from?: string; to?: string; dateType?: "booked" | "session" | "either"; ageMin?: number; ageMax?: number; when?: "any" | "upcoming" | "past"; repeatOnly?: boolean; paymentMethod?: string }
interface Audience { id: string; name: string; count: number; emails: string[]; desc: string; filter?: AudFilter; people?: { email: string; name?: string }[]; folder?: string }
type CampStatus = "sent" | "sending" | "scheduled" | "draft";
interface Campaign { id: string; name: string; subtitle?: string; audienceName: string; recipients: number; status: CampStatus; statusDate?: string; opens?: number; clicks?: number; subject?: string; html?: string; body?: string; design?: CampaignDesign; scheduledAt?: string; recipientEmails?: string[]; emailId?: string; schedId?: string; delivered?: number; opened?: number }

// Only the campaign DESIGNS live locally (drafts + content for reuse) — the
// send/schedule/tracking state is the server's (`emails` history +
// `scheduledEmails`), linked back by emailId/schedId.
const LS_CAMP = "aos.email.campaigns.v1", LS_AUD = "aos.email.audiences.v1";
function readLS<T>(k: string, fb: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; } }
function writeLS(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }

// ── Enquiries (potential customers who emailed but never booked). Stored locally
// (front-end); backend later swaps this for a real enquiries table + inbound link.
// They're a LIVE segment: once someone books, they drop out automatically.
interface EnquiryRec { email: string; name?: string; location?: string; at?: string }
const LS_ENQ = "aos.email.enquiries.v1";
// Per-location + all enquiry audiences, EXCLUDING anyone who has since booked.
function computeEnquiryAudiences(enquiries: EnquiryRec[], bookings: Booking[]): Audience[] {
  const booked = new Set(bookings.map((b) => b.email?.toLowerCase()).filter(Boolean));
  const active = enquiries.filter((e) => e.email && !booked.has(e.email.toLowerCase()));
  const byLoc = new Map<string, Map<string, string>>(); const all = new Map<string, string>(); // email → name
  for (const e of active) { const em = e.email.toLowerCase(); const nm = e.name || em; all.set(em, nm); const loc = e.location || "No location"; (byLoc.get(loc) ?? byLoc.set(loc, new Map()).get(loc)!).set(em, nm); }
  const ppl = (m: Map<string, string>) => [...m].map(([email, name]) => ({ email, name }));
  const out: Audience[] = [{ id: "enq-all", name: "New enquiries — all", count: all.size, emails: [...all.keys()], people: ppl(all), desc: "Emailed us · never booked" }];
  for (const [loc, ems] of byLoc) out.push({ id: `enq-${loc}`, name: `New enquiries · ${loc}`, count: ems.size, emails: [...ems.keys()], people: ppl(ems), desc: `Enquired about ${loc} · never booked` });
  return out;
}
const STATUS_PILL: Record<CampStatus, { bg: string; fg: string; label: string }> = {
  sent: { bg: "#dff3e6", fg: "#127a3e", label: "Sent" }, sending: { bg: "#fdeccf", fg: "#9a5a00", label: "Sending" },
  scheduled: { bg: "#e4edfd", fg: "#1d3a8f", label: "Scheduled" }, draft: { bg: "var(--panel)", fg: "var(--ink-2)", label: "Draft" },
};
const parseDate = (s?: string) => { if (!s) return null; const t = Date.parse(s); return Number.isNaN(t) ? null : new Date(t); };
const bookedDate = (b: Booking) => parseDate(b.createdAt);           // when the booking was MADE
const sessionDate = (b: Booking) => parseDate(b.date || b.createdAt); // when the child ATTENDS
const fmtD = (s?: string) => { const d = parseDate(s); return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""; };
function matchBooking(b: Booking, f: AudFilter): boolean {
  if (f.location && (b.locationName || "") !== f.location) return false;
  if (f.paymentMethod && (b.method || "") !== f.paymentMethod) return false;
  if (f.listingIds?.length) { const ok = f.listingIds.includes(b.listingId || "\0") || (!!b.title && !!f.listingTitles?.includes(b.title)) || (!!b.listingTitle && !!f.listingTitles?.includes(b.listingTitle)); if (!ok) return false; }
  if (f.ageMin != null && b.age != null && b.age < f.ageMin) return false;
  if (f.ageMax != null && f.ageMax < 18 && b.age != null && b.age > f.ageMax) return false;
  if (f.from || f.to) {
    const inR = (d: Date | null) => !!d && (!f.from || d >= new Date(f.from)) && (!f.to || d <= new Date(`${f.to}T23:59:59`));
    const bd = bookedDate(b), sd = sessionDate(b);
    const ok = f.dateType === "session" ? inR(sd) : f.dateType === "either" ? (inR(bd) || inR(sd)) : inR(bd);
    if (!ok) return false;
  }
  if (f.when && f.when !== "any") { const sd = sessionDate(b); if (!sd) return false; const future = sd.getTime() >= Date.now(); if (f.when === "upcoming" && !future) return false; if (f.when === "past" && future) return false; }
  return true;
}
function resolveAudience(bookings: Booking[], f: AudFilter): { emails: string[]; count: number } {
  const cnt = new Map<string, number>();
  for (const b of bookings) if (b.email && matchBooking(b, f)) { const e = b.email.toLowerCase(); cnt.set(e, (cnt.get(e) ?? 0) + 1); }
  let emails = [...cnt.keys()];
  if (f.repeatOnly) emails = emails.filter((e) => (cnt.get(e) ?? 0) >= 2);
  return { emails, count: emails.length };
}
function filterDesc(f: AudFilter): string {
  const b: string[] = [];
  if (f.location) b.push(f.location);
  if (f.listingIds?.length) b.push(f.listingIds.length === 1 ? (f.listingTitles?.[0] || "a listing") : `${f.listingIds.length} listings`);
  if (f.ageMin != null || f.ageMax != null) { const lo = f.ageMin ?? 0, hi = f.ageMax ?? 18; if (!(lo === 0 && hi === 18)) b.push(`ages ${lo}–${hi >= 18 ? "18+" : hi}`); }
  if (f.from || f.to) { const w = f.dateType === "session" ? "attending" : f.dateType === "either" ? "booked/attending" : "booked"; b.push(`${w} ${f.from || "…"}–${f.to || "…"}`); }
  if (f.when === "upcoming") b.push("upcoming sessions"); if (f.when === "past") b.push("past attendees");
  if (f.repeatOnly) b.push("repeat customers");
  return b.length ? b.join(" · ") : "All customers";
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div><div className="mt-1 text-[26px] font-extrabold" style={{ color: tone ?? "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{value}</div>{sub && <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{sub}</div>}</div>;
}
function FunnelBar({ label, n, max, color }: { label: string; n: number; max: number; color: string }) {
  return <div className="mb-2.5"><div className="flex justify-between text-[13px]"><span className="text-[var(--ink-2)]">{label}</span><span className="font-bold text-[var(--ink)]">{n}</span></div><div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${max ? Math.round((n / max) * 100) : 0}%`, background: color }} /></div></div>;
}

function AudienceBuilder({ bookings, listings, locations, onCancel, onCreate }: { bookings: Booking[]; listings: { id: string; title: string; location?: string; runFrom?: string; runTo?: string }[]; locations: string[]; onCancel: () => void; onCreate: (a: Audience, useNow: boolean) => void }) {
  const [f, setF] = useState<AudFilter>({});
  const [name, setName] = useState("");
  const seq = useRef(0);
  const set = (p: Partial<AudFilter>) => setF((x) => ({ ...x, ...p }));
  const { emails, count } = resolveAudience(bookings, f);
  // Listings for the chosen location (via their bookings), each with its run dates.
  const listingsHere = listings.filter((l) => !f.location || l.location === f.location);
  const runLabel = (l: { id: string; runFrom?: string; runTo?: string }) => {
    if (l.runFrom || l.runTo) return `${fmtD(l.runFrom) || "…"} – ${fmtD(l.runTo) || "…"}`;
    const ds = bookings.filter((b) => b.listingId === l.id).map((b) => sessionDate(b)).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
    return ds.length ? `${ds[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${ds[ds.length - 1].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "dates n/a";
  };
  const AGES = Array.from({ length: 19 }, (_, i) => i); // 0..18 (18 = 18+)
  const lo = f.ageMin ?? 0, hi = f.ageMax ?? 18;
  const mk = (): Audience => ({ id: `aud-${name.trim() || "seg"}-${seq.current++}`, name: name.trim() || filterDesc(f), count, emails, desc: filterDesc(f), filter: f });
  const seg = (opts: [string, string][], val: string, on: (v: string) => void) => (
    <div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)]">{opts.map(([v, l]) => <button key={v} type="button" onClick={() => on(v)} className="px-3 py-1.5 text-[12px] font-bold transition-colors" style={val === v ? { background: "#eef4fd", color: "#1d3a8f" } : { color: "var(--ink-2)" }}>{l}</button>)}</div>
  );
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onCancel}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0f9d58] text-white">●</span>
          <div><div className="text-[16px] font-extrabold text-[var(--ink)]">Build an audience</div><div className="text-[12px] text-[var(--ink-3)]">Filter your customers — the count updates live.</div></div>
          <button type="button" onClick={onCancel} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[var(--ink-3)] hover:bg-[var(--panel)]">×</button>
        </div>
        <div className="max-h-[62vh] space-y-3.5 overflow-y-auto p-5">
          <div><FieldLabel>Location</FieldLabel><Select value={f.location ?? ""} onChange={(e) => set({ location: e.target.value || undefined, listingIds: [], listingTitles: [] })} className="w-full"><option value="">Any location</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
          <div>
            <div className="mb-1 flex items-center justify-between"><FieldLabel>Listings — pick any (dates each ran)</FieldLabel>{listingsHere.length > 0 && <span className="flex gap-2 text-[11.5px] font-bold"><button type="button" onClick={() => set({ listingIds: listingsHere.map((l) => l.id), listingTitles: listingsHere.map((l) => l.title) })} className="text-[#1d3a8f]">Select all</button>{f.listingIds?.length ? <button type="button" onClick={() => set({ listingIds: [], listingTitles: [] })} className="text-[var(--ink-3)]">Clear</button> : null}</span>}</div>
            <div className="flex flex-wrap gap-1.5">
              {listingsHere.length === 0 ? <span className="text-[11.5px] text-[var(--ink-3)]">No listings{f.location ? ` in ${f.location}` : ""} yet.</span>
                : listingsHere.map((l) => { const on = f.listingIds?.includes(l.id); return <button key={l.id} type="button" onClick={() => { const ids = new Set(f.listingIds ?? []); const titles = new Set(f.listingTitles ?? []); if (on) { ids.delete(l.id); titles.delete(l.title); } else { ids.add(l.id); titles.add(l.title); } set({ listingIds: [...ids], listingTitles: [...titles] }); }} className="rounded-lg border px-2.5 py-1.5 text-[12px] font-bold" style={on ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{l.title} <span className="font-normal text-[var(--ink-3)]">· {runLabel(l)}</span></button>; })}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--line)] p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><FieldLabel>Date range</FieldLabel>{seg([["booked", "Booking made"], ["session", "Sessions attended"], ["either", "Either"]], f.dateType ?? "booked", (v) => set({ dateType: v as AudFilter["dateType"] }))}</div>
            <div className="grid grid-cols-2 gap-2.5"><Input type="date" value={f.from ?? ""} onChange={(e) => set({ from: e.target.value })} className="w-full" /><Input type="date" value={f.to ?? ""} onChange={(e) => set({ to: e.target.value })} className="w-full" /></div>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">Whether these are the dates the booking was <b>made</b> or the dates the child <b>attended</b> — or match either.</p>
          </div>
          <div><FieldLabel>Age of child</FieldLabel>
            {(() => { const allAges = f.ageMin == null && f.ageMax == null; return (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => set({ ageMin: undefined, ageMax: undefined })} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${allAges ? "bg-[#16306e] text-white shadow-sm" : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>All ages (0–18+)</button>
                <span className="text-[12.5px] text-[var(--ink-3)]">or pick a range:</span>
                <span className="text-[12.5px] text-[var(--ink-2)]">From</span>
                <Select value={allAges ? "" : String(lo)} onChange={(e) => set({ ageMin: Number(e.target.value), ageMax: f.ageMax ?? 18 })} className="w-20">{allAges && <option value="">–</option>}{AGES.map((a) => <option key={a} value={a}>{a}</option>)}</Select>
                <span className="text-[12.5px] text-[var(--ink-2)]">to</span>
                <Select value={allAges ? "" : String(hi)} onChange={(e) => set({ ageMin: f.ageMin ?? 0, ageMax: Number(e.target.value) })} className="w-20">{allAges && <option value="">–</option>}{AGES.map((a) => <option key={a} value={a}>{a === 18 ? "18+" : a}</option>)}</Select>
              </div>
            ); })()}
          </div>
          <div className="rounded-xl border border-[var(--line)] p-3">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">More filters</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] text-[var(--ink-2)]">Sessions</span>{seg([["any", "Any"], ["upcoming", "Upcoming"], ["past", "Past"]], f.when ?? "any", (v) => set({ when: v as AudFilter["when"] }))}
              <label className="ml-2 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={!!f.repeatOnly} onChange={(e) => set({ repeatOnly: e.target.checked })} /> Repeat customers only (2+)</label>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[var(--panel)] p-3.5">
            <div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Matching</div><div className="text-[30px] font-extrabold leading-none text-[#2f6bd8]" style={{ fontVariantNumeric: "tabular-nums" }}>{count}</div><div className="text-[10px] text-[var(--ink-3)]">customers</div></div>
            <div className="text-[13px] font-semibold text-[var(--ink-2)]">{filterDesc(f)}</div>
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

function NewCampaign({ audiences, templates, initialAudienceId, company, socials, onCancel, onSubmit, onRemovePerson }: { audiences: Audience[]; templates: EmailTemplate[]; initialAudienceId?: string | null; company?: Partial<Company>; socials?: Social[]; onCancel: () => void; onSubmit: (c: { name: string; audience: Audience; template?: EmailTemplate; subject: string; html?: string; body?: string; design?: CampaignDesign; scheduledAt?: string }, action: CampStatus) => void | Promise<void>; onRemovePerson?: (email: string) => void }) {
  const [name, setName] = useState("");
  const [audIds, setAudIds] = useState<string[]>(initialAudienceId ? [initialAudienceId] : (audiences[0] ? [audiences[0].id] : []));
  const [tmplId, setTmplId] = useState(templates[0]?.id ?? "");
  const [tmplBody, setTmplBody] = useState(() => templates[0]?.body ?? "");   // editable copy of the worded template
  const [aiBusy, setAiBusy] = useState(false);
  const [cdOn, setCdOn] = useState(false);   // add a big countdown clock to a worded email
  const [cdDate, setCdDate] = useState("");
  const [cdTime, setCdTime] = useState("");
  const [cdHeading, setCdHeading] = useState("Hurry — offer ends soon");
  const [subject, setSubject] = useState("");
  const [excludedEmails, setExcludedEmails] = useState<string[]>([]);
  const [showList, setShowList] = useState(false);
  const [mode, setMode] = useState<"template" | "design">("template");
  const [design, setDesign] = useState<CampaignDesign | null>(null);   // a designed email (rich template gallery)
  const [designing, setDesigning] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNowMs(Date.now()), 1000); return () => clearInterval(id); }, []);
  const [previewBig, setPreviewBig] = useState(false);
  const template = templates.find((t) => t.id === tmplId);
  const selectedAuds = audIds.map((id) => audiences.find((a) => a.id === id)).filter((a): a is Audience => !!a);
  const primary = selectedAuds[0];
  // Union of everyone across the chosen audiences — DEDUPED by email so nobody is emailed twice.
  const peopleMap = new Map<string, { email: string; name?: string }>();
  const enqEmails = new Set<string>();
  for (const a of selectedAuds) {
    const ppl = a.people?.length ? a.people : a.emails.map((e) => ({ email: e, name: undefined as string | undefined }));
    const isEnq = a.id.startsWith("enq-");
    for (const p of ppl) { const k = p.email.toLowerCase(); if (!peopleMap.has(k)) peopleMap.set(k, { email: p.email, name: p.name }); if (isEnq) enqEmails.add(k); }
  }
  const people = [...peopleMap.values()];
  const excluded = new Set(excludedEmails.map((e) => e.toLowerCase()));
  const toggleExclude = (email: string) => setExcludedEmails((xs) => { const k = email.toLowerCase(); return xs.some((e) => e.toLowerCase() === k) ? xs.filter((e) => e.toLowerCase() !== k) : [...xs, email]; });
  const included = people.filter((p) => !excluded.has(p.email.toLowerCase()));
  const hasEnquiryAud = selectedAuds.some((a) => a.id.startsWith("enq-"));
  const availableToAdd = audiences.filter((a) => !audIds.includes(a.id));
  const segG = availableToAdd.filter((a) => a.id === "all" || a.id.startsWith("seg-"));
  const enqG = availableToAdd.filter((a) => a.id.startsWith("enq-"));
  const cusG = availableToAdd.filter((a) => !(a.id === "all" || a.id.startsWith("seg-") || a.id.startsWith("enq-")));
  const addAud = (id: string) => { if (id) setAudIds((xs) => (xs.includes(id) ? xs : [...xs, id])); };
  const removeAud = (id: string) => setAudIds((xs) => (xs.length > 1 ? xs.filter((x) => x !== id) : xs));
  const useDesign = mode === "design" && !!design;
  const contentReady = mode === "template" || useDesign;   // send actions show once there's content
  const [schedAt, setSchedAt] = useState("");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<CampStatus | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [chooseView, setChooseView] = useState(false);   // Content step: show just the two options (Worded / Design)
  const [savedDesigns, setSavedDesigns] = useState<SavedTemplate[]>(() => loadMyTemplates());
  const STEPS = ["Name", "Audience", "Subject", "Content"];
  const lastStep = STEPS.length - 1;
  const nextDisabled = !!busy || (step === 1 && !primary);
  const submit = async (action: CampStatus) => {
    if (!primary) { setSendErr("Pick an audience for this send first."); return; }
    if (action === "scheduled" && !schedAt) { setSendErr("Pick a date & time to schedule the send."); return; }
    const subj = subject.trim() || template?.subject || name.trim();
    const combined: Audience = { id: primary.id, name: selectedAuds.length > 1 ? `${primary.name} +${selectedAuds.length - 1} more` : primary.name, count: included.length, emails: included.map((p) => p.email), desc: primary.desc };
    setSendErr(null); setBusy(action);
    try {
      const html = useDesign && design ? renderDesignHtml(design, company, nowMs) : (mode === "template" && wordedHasCountdown ? renderDesignHtml(wordedDesign(), company, nowMs) : undefined);
      await onSubmit({ name: name.trim() || subj || "Untitled campaign", audience: combined, template: mode === "template" ? template : undefined, subject: subj, html, body: useDesign && design ? renderDesignText(design) : (mode === "template" ? tmplBody.trim() || undefined : undefined), design: useDesign ? (design ?? undefined) : undefined, scheduledAt: action === "scheduled" ? schedAt : undefined }, action);
      if (action === "sent") { if (useDesign) { setSaveName(name.trim() || subject.trim() || "My design"); setSentOk(true); } else onCancel(); }   // designed send → offer to save; worded → just close
    } catch (e) { setSendErr(e instanceof Error ? e.message : "Couldn’t send — please try again."); }
    finally { setBusy(null); }
  };
  const pickTemplate = (id: string) => { setTmplId(id); setTmplBody(templates.find((t) => t.id === id)?.body ?? ""); };
  const insertMerge = (token: string) => setTmplBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}${token}`);
  const aiWrite = async () => {
    const notes = window.prompt("What should this email say? A line or two — the writer turns it into a friendly email.");
    if (!notes?.trim()) return;
    setAiBusy(true); setSendErr(null);
    try { const r = await apiPost<{ title: string; body: string }>("/api/ai/compose", { kind: "announce", notes: notes.trim(), length: "medium" }); if (r.title && !subject.trim()) setSubject(r.title); if (r.body) setTmplBody((b) => (b.trim() ? `${b}\n\n${r.body}` : r.body)); }
    catch (e) { setSendErr(e instanceof Error ? e.message : "The writer couldn’t draft that — try again."); }
    finally { setAiBusy(false); }
  };
  // Reuse a previous campaign — pull its content across, then edit via the steps.
  // Reuse a previously-saved design — load it so it can be edited. Shared with the
  // designer's ⭐ My templates store, so a post-send save shows up in both places.
  const reuseSaved = (s: SavedTemplate) => { if (!name.trim()) setName(s.name ? `${s.name} (copy)` : ""); setMode("design"); setDesign({ templateId: "", accent: s.accent, blocks: s.blocks }); };
  const saveCurrentDesign = () => { if (!design) return; const nm = saveName.trim() || "Saved design"; const item: SavedTemplate = { id: `sv-${nowMs}`, name: nm, accent: design.accent, blocks: design.blocks }; const next = [item, ...savedDesigns.filter((x) => x.name !== nm)]; setSavedDesigns(next); persistMyTemplates(next); };
  // One-click countdown for the current design (templates don't include one) — adds a dated countdown so the clock shows.
  const addCountdownToDesign = () => { const d = new Date(Date.now() + 14 * 86400000); const p = (n: number) => String(n).padStart(2, "0"); const dateStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; setDesign((dz) => { if (!dz) return dz; const idx = dz.blocks.findIndex((b) => b.t === "countdown"); if (idx >= 0) return { ...dz, blocks: dz.blocks.map((b, i) => (i === idx ? { ...b, date: b.date || dateStr, time: b.time || "18:00" } : b)) }; return { ...dz, blocks: [...dz.blocks, { t: "countdown", heading: "Hurry — offer ends soon", label: "", date: dateStr, time: "18:00" } as Block] }; }); };
  // A worded email that includes a big countdown is sent as HTML (text block + countdown block).
  const wordedHasCountdown = cdOn && !!cdDate;
  // Countdown status for the current content — so "no clock in the email" is obvious before sending.
  const designCd = useDesign ? design?.blocks.find((b) => b.t === "countdown") : undefined;
  const cdMissingDate = (!!designCd && !designCd.date) || (mode === "template" && cdOn && !cdDate);
  const cdIncluded = (!!designCd && !!designCd.date) || (mode === "template" && wordedHasCountdown);
  const wordedDesign = (): CampaignDesign => { const blocks: Block[] = []; if (tmplBody.trim()) blocks.push({ t: "text", body: tmplBody }); if (wordedHasCountdown) blocks.push({ t: "countdown", date: cdDate, time: cdTime, heading: cdHeading, label: "" }); return { accent: "blue", blocks }; };
  return (
    <>
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onCancel}>
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <style>{`.camp-scroll{overflow-y:scroll}.camp-scroll::-webkit-scrollbar{width:14px}.camp-scroll::-webkit-scrollbar-track{background:#e7ecf4;border-radius:8px}.camp-scroll::-webkit-scrollbar-thumb{background:#8aa0c6;border-radius:8px;border:3px solid #e7ecf4;min-height:44px}.camp-scroll::-webkit-scrollbar-thumb:hover{background:#5f7cab}`}</style>
        <div className="rounded-t-2xl px-6 py-4 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="text-[19px] font-extrabold">New campaign</div><div className="truncate text-[12.5px] text-white/80">{primary ? <>To <b className="font-extrabold text-white">{primary.name}</b>{selectedAuds.length > 1 ? ` +${selectedAuds.length - 1} more` : ""} · {included.length} recipient{included.length === 1 ? "" : "s"}</> : "Branded-domain send with tracking + unsubscribe."}</div></div>
            <div className="flex flex-none items-center gap-3"><span className="text-[12px] font-bold text-white/85">Step {step + 1} of {STEPS.length}</span><button type="button" onClick={onCancel} disabled={!!busy} title="Cancel" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[16px] font-bold hover:bg-white/30 disabled:opacity-40">×</button></div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {STEPS.map((s, i) => <button key={s} type="button" onClick={() => setStep(i)} title={s} className="flex-1"><div className={`h-1.5 rounded-full transition ${i <= step ? "bg-white" : "bg-white/25"}`} /></button>)}
          </div>
        </div>
        <div className="camp-scroll max-h-[64vh] bg-[#f4f7fc] px-8 py-6">
          <div className="mx-auto flex min-h-[210px] max-w-2xl flex-col">
            {step === 0 && <div className="space-y-5">
              <div><div className="text-[27px] font-extrabold leading-tight tracking-tight text-[#16306e]">Let&apos;s name your campaign</div><p className="mt-1.5 text-[14.5px] text-[var(--ink-3)]">Just for you — recipients never see this. Pick something you&apos;ll recognise later.</p></div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. August football camp" className="w-full rounded-2xl border-2 border-[var(--line)] bg-white px-5 py-4 text-[19px] font-semibold text-[var(--ink)] shadow-sm outline-none transition focus:border-[#3f78d8]" />
            </div>}
            {step === 1 && <div className="space-y-5">
              <div><div className="text-[27px] font-extrabold leading-tight tracking-tight text-[#16306e]">Who&apos;s it going to?</div><p className="mt-1.5 text-[14.5px] text-[var(--ink-3)]">Combine any audiences — recipients are deduped so no one is emailed twice.</p></div>
              <div className="flex flex-wrap gap-2">{selectedAuds.map((a) => <span key={a.id} className="inline-flex items-center gap-2 rounded-full bg-[#eef4fd] px-4 py-2 text-[14px] font-bold text-[#1d3a8f]">{a.name} <span className="rounded-full bg-white/70 px-1.5 text-[12px]">{a.count}</span>{selectedAuds.length > 1 && <button type="button" onClick={() => removeAud(a.id)} className="text-[#1d3a8f]/50 hover:text-[#c02636]" title="Remove from this send">✕</button>}</span>)}</div>
              {availableToAdd.length > 0 && <Select value="" onChange={(e) => addAud(e.target.value)} className="w-full max-w-md"><option value="">＋ Add another audience…</option>{segG.length > 0 && <optgroup label="🎯 Groups">{segG.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.count})</option>)}</optgroup>}{enqG.length > 0 && <optgroup label="📩 Enquiries">{enqG.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.count})</option>)}</optgroup>}{cusG.length > 0 && <optgroup label="⭐ Your audiences">{cusG.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.count})</option>)}</optgroup>}</Select>}
              <div className="rounded-xl border border-[#cfe0f7] bg-white px-4 py-3 text-[13.5px] font-semibold text-[#1d3a8f] shadow-sm">📤 This send reaches <b>{included.length}</b> contact{included.length === 1 ? "" : "s"}{excluded.size > 0 ? ` · ${excluded.size} skipped` : ""}.</div>
            </div>}
            {step === 2 && <div className="space-y-5">
              <div><div className="text-[27px] font-extrabold leading-tight tracking-tight text-[#16306e]">What&apos;s the subject line?</div><p className="mt-1.5 text-[14.5px] text-[var(--ink-3)]">The first thing people read in their inbox — make it count.</p></div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. ☀️ August camp places are open!" className="w-full rounded-2xl border-2 border-[var(--line)] bg-white px-5 py-4 text-[19px] font-semibold text-[var(--ink)] shadow-sm outline-none transition focus:border-[#3f78d8]" />
            </div>}
            {step === 3 && <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><div className="text-[27px] font-extrabold leading-tight tracking-tight text-[#16306e]">How should it look?</div><p className="mt-1.5 text-[14.5px] text-[var(--ink-3)]">Use a ready-worded template, or design your own branded email.</p></div>
                <div className="inline-flex overflow-hidden rounded-xl border border-[var(--line)] bg-white text-[13px] font-bold shadow-sm">{([["template", "📄 Worded templates"], ["design", "🎨 Design your own"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => { setMode(k); setChooseView(false); }} className="px-4 py-2.5" style={!chooseView && mode === k ? { background: "#eef4fd", color: "#1d3a8f" } : { color: "var(--ink-2)" }}>{l}</button>)}</div>
              </div>
              {chooseView && <div className="rounded-2xl border-2 border-dashed border-[#cfe0f7] bg-white p-8 text-center shadow-sm"><div className="text-[15px] font-extrabold text-[var(--ink)]">How should your email look?</div><p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--ink-3)]">Tap <b>📄 Worded templates</b> or <b>🎨 Design your own</b> above to choose.</p></div>}
              {!chooseView && <>
              {mode === "template"
                ? <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm"><Select value={tmplId} onChange={(e) => pickTemplate(e.target.value)} className="w-full"><option value="">Start from blank</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                    <div className="mt-3"><FieldLabel>Subject line</FieldLabel><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. A quick reminder about your booking" className="w-full" /></div>
                    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[#f4f7fc] px-3 py-2">
                        <button type="button" onClick={aiWrite} disabled={aiBusy} className="rounded-md border border-[#7c3aed] px-2 py-1 text-[11.5px] font-extrabold text-[#7c3aed] hover:bg-[#f5f0ff] disabled:opacity-50">{aiBusy ? "✨ Writing…" : "✨ Help me write"}</button>
                        <button type="button" onClick={() => { const on = !cdOn; if (on && !cdDate) { const d = new Date(Date.now() + 14 * 86400000); const p = (n: number) => String(n).padStart(2, "0"); setCdDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`); setCdTime("18:00"); } setCdOn(on); }} className={`rounded-md border px-2 py-1 text-[11.5px] font-bold ${cdOn ? "border-[#1d3a8f] bg-[#eef4fd] text-[#1d3a8f]" : "border-[var(--line)] bg-white text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>⏱ Countdown</button>
                        <span className="mx-1 h-4 w-px bg-[var(--line)]" />
                        <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Insert:</span>
                        {MERGE_FIELDS.slice(0, 6).map((f) => <button key={f.token} type="button" title={f.desc} onClick={() => insertMerge(f.token)} className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{f.token}</button>)}
                      </div>
                      <textarea value={tmplBody} onChange={(e) => setTmplBody(e.target.value)} rows={9} placeholder="Write your email… use merge fields like {ChildName} or {ListingName} and they fill in per family." className="w-full resize-y bg-white px-4 py-3 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none" />
                      {cdOn && <div className="border-t border-[var(--line)] bg-[#f7f9fc] px-3 py-3">
                        <div className="mb-2 flex items-center gap-2"><span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">⏱ Countdown clock</span><button type="button" onClick={() => setCdOn(false)} className="ml-auto text-[11px] font-bold text-[#c02636] hover:underline">Remove</button></div>
                        <div className="grid gap-2 sm:grid-cols-3"><input value={cdHeading} onChange={(e) => setCdHeading(e.target.value)} placeholder="Heading" className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px]" /><input type="date" value={cdDate} onChange={(e) => setCdDate(e.target.value)} className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px]" /><input type="time" value={cdTime} onChange={(e) => setCdTime(e.target.value)} className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px]" /></div>
                        {wordedHasCountdown
                          ? <div className="mt-3 overflow-hidden rounded-lg" dangerouslySetInnerHTML={{ __html: renderDesignHtml({ accent: "blue", blocks: [{ t: "countdown", date: cdDate, time: cdTime, heading: cdHeading, label: "" }] as Block[] }, company, nowMs) }} />
                          : <p className="mt-2 text-[11px] font-semibold text-[#9a6b00]">Pick a date so the big clock appears in your email.</p>}
                      </div>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setPreviewBig(true)} className="rounded-lg border border-[#dbe6fb] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">⤢ Preview email</button><p className="text-[11.5px] text-[var(--ink-3)]">Edit freely — this text becomes the email body. Merge fields resolve per family on send.</p></div>
                  </div>
                : design
                  ? <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                      <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">Your design</span><button type="button" onClick={() => setDesigning(true)} className="ml-auto rounded-lg border border-[#dbe6fb] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">✏️ Edit</button><button type="button" onClick={() => setPreviewBig(true)} className="rounded-lg border border-[#dbe6fb] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">⤢ Pop out</button><button type="button" onClick={() => setDesign(null)} className="rounded-lg border border-[#f0c9cd] px-3 py-1.5 text-[12px] font-bold text-[#c02636] hover:bg-[#fdecec]">Discard</button></div>
                      {designCd
                        ? <div className="mb-2 rounded-lg border border-[#bfe6cf] bg-[#eafaf0] px-3 py-2 text-[12.5px] font-bold text-[#127a3e]">⏱ Countdown clock is in this email — it&apos;ll send as a big ticking clock.</div>
                        : <button type="button" onClick={addCountdownToDesign} className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#bfe0c9] bg-[#f0faf3] px-4 py-3 text-[13.5px] font-extrabold text-[#127a3e] hover:bg-[#e3f6ea]">⏱ Add a big countdown clock to this email</button>}
                      <button type="button" onClick={() => setPreviewBig(true)} title="Click to enlarge" className="block w-full cursor-zoom-in overflow-hidden rounded-xl border border-[var(--line)] bg-[#eef1f6] p-3"><div className="mx-auto max-h-80 max-w-[560px] overflow-hidden rounded-lg bg-white shadow-sm" dangerouslySetInnerHTML={{ __html: renderDesignHtml(design, company, nowMs) }} /></button>
                    </div>
                  : <div className="rounded-2xl border-2 border-dashed border-[#cfe0f7] bg-white p-8 text-center shadow-sm">
                      <div className="text-[16px] font-extrabold text-[var(--ink)]">Design your own email</div>
                      <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--ink-3)]">Start a fresh design in the builder, or pick up a previous designed campaign and tweak it.</p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                        <button type="button" onClick={() => setDesigning(true)} className="rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>🎨 Go to new builder</button>
                        {savedDesigns.length > 0 && <Select value="" onChange={(e) => { const s = savedDesigns.find((x) => x.id === e.target.value); if (s) reuseSaved(s); }} className="max-w-[260px]"><option value="">📋 Use a saved one…</option>{savedDesigns.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
                      </div>
                    </div>}
              {cdMissingDate && <div className="rounded-xl border border-[#f2c4c9] bg-[#fdf0f1] px-4 py-3 text-[13px] font-semibold text-[#c02636]">⚠ Your countdown has no date set, so the clock won&apos;t appear. Open the {useDesign ? "designer" : "⏱ Countdown panel"} and set a date &amp; time.</div>}
              {cdIncluded && <div className="rounded-xl border border-[#bfe6cf] bg-[#eafaf0] px-4 py-3 text-[13px] font-semibold text-[#127a3e]">⏱ Countdown included — it&apos;ll send as a big clock in the email.</div>}
              <div className="rounded-xl border border-[#cfe0f7] bg-gradient-to-r from-[#eef4ff] to-white px-4 py-3 text-[13.5px] font-semibold text-[#1d3a8f] shadow-sm">📤 Sending to <b>{included.length}</b> contact{included.length === 1 ? "" : "s"}{excluded.size > 0 ? ` · ${excluded.size} skipped` : ""}{selectedAuds.length > 1 ? ` · deduped across ${selectedAuds.length} audiences` : ""}.</div>
              {people.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
                  <button type="button" onClick={() => setShowList((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left"><span className="text-[13px] font-extrabold text-[var(--ink)]">Recipients</span><span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[11.5px] font-extrabold text-[#1d3a8f] tabular-nums">{included.length} of {people.length}</span><span className="ml-auto text-[12px] font-bold text-[var(--ink-3)]">{showList ? "▲ Hide" : "▼ Show"}</span></button>
                  {showList && <div className="max-h-52 overflow-y-auto border-t border-[var(--line)]">
                    {people.map((p) => { const off = excluded.has(p.email.toLowerCase()); return (
                      <div key={p.email} className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2 last:border-0">
                        <div className="min-w-0 flex-1"><div className={`truncate text-[13px] font-semibold ${off ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"}`}>{p.name || p.email}</div>{p.name && p.name !== p.email && <div className="truncate text-[11.5px] text-[var(--ink-3)]">{p.email}</div>}</div>
                        <button type="button" onClick={() => toggleExclude(p.email)} className={`flex-none rounded-full border px-2.5 py-1 text-[11px] font-bold ${off ? "border-[#bfe6cf] text-[#127a3e] hover:bg-[#eafaf0]" : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>{off ? "↩ Add back" : "Skip this send"}</button>
                        {enqEmails.has(p.email.toLowerCase()) && onRemovePerson && <button type="button" onClick={() => onRemovePerson(p.email)} className="flex-none rounded-full border border-[#f0c9cd] px-2.5 py-1 text-[11px] font-bold text-[#c02636] hover:bg-[#fdecec]" title="Remove from the enquiries list for good">🗑 Remove</button>}
                      </div>
                    ); })}
                  </div>}
                  <div className="border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--ink-3)]">{hasEnquiryAud ? "“Skip this send” leaves them on the list for next time. “Remove” takes them off the enquiries board entirely." : "“Skip this send” excludes them from this campaign only."} Duplicate addresses are merged automatically.</div>
                </div>
              )}
              <p className="text-[12px] text-[var(--ink-3)]">Opted-out recipients are excluded automatically; a one-click unsubscribe footer is added to every send.</p>
              </>}
            </div>}
          </div>
        </div>
        {sendErr && <div className="mx-6 mt-3 flex items-start gap-2 rounded-lg border border-[#f2c4c9] bg-[#fdf0f1] px-3 py-2 text-[12.5px] font-semibold text-[#c02636]"><span>⚠</span><span>{sendErr}</span></div>}
        <div className="flex items-center gap-2 border-t border-[var(--line)] px-6 py-3.5">
          <button type="button" onClick={() => { if (step === 0) return onCancel(); if (step === lastStep && !chooseView) return setChooseView(true); setChooseView(false); setStep(step - 1); }} disabled={!!busy} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-40">{step === 0 ? "Cancel" : "← Back"}</button>
          <div className="ml-auto flex items-center gap-2">
            {step < lastStep
              ? <button type="button" onClick={() => setStep(step + 1)} disabled={nextDisabled} className="rounded-lg px-6 py-2 text-[13px] font-extrabold text-white shadow-sm disabled:opacity-40" style={{ background: "linear-gradient(180deg,#3f78d8,#1d3a8f)" }}>Next →</button>
              : <>
                  <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-1.5 py-1"><input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} title="Schedule for" className="rounded bg-transparent px-1 py-1 text-[12px] text-[var(--ink)] outline-none" /><button type="button" onClick={() => submit("scheduled")} disabled={!!busy || !contentReady || chooseView} className="rounded-md bg-[#1d3a8f] px-3 py-1.5 text-[12.5px] font-extrabold text-white hover:brightness-110 disabled:opacity-40">{busy === "scheduled" ? "Scheduling…" : "⧗ Schedule"}</button></div>
                  <button type="button" onClick={() => submit("sent")} disabled={included.length === 0 || !contentReady || chooseView || !!busy} className="rounded-lg px-5 py-2 text-[13px] font-extrabold text-white disabled:opacity-40" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>{busy === "sent" ? "Sending…" : "Send now"}</button>
                </>}
          </div>
        </div>
      </div>
    </div>
    {previewBig && (
      <div className="fixed inset-0 z-[140] flex flex-col bg-[#0b1730]/70 p-4 backdrop-blur-[2px]" onClick={() => setPreviewBig(false)}>
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 py-2 text-white"><span className="text-[13px] font-extrabold">Email preview</span><span className="text-[12px] text-white/70">This is roughly how it lands in a parent&apos;s inbox.</span><button type="button" onClick={() => setPreviewBig(false)} className="ml-auto rounded-lg bg-white/15 px-3 py-1.5 text-[13px] font-bold hover:bg-white/25">✕ Close</button></div>
        <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto max-w-[600px]" dangerouslySetInnerHTML={{ __html: renderDesignHtml(useDesign && design ? design : wordedDesign(), company, nowMs) }} />
        </div>
      </div>
    )}
    {designing && <div className="relative z-[145]"><CampaignDesigner initial={design} company={company} socials={socials} onCancel={() => setDesigning(false)} onSave={(d) => { setDesign(d); setDesigning(false); }} /></div>}
    {sentOk && (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f6ee] text-[24px]">✅</div>
          <div className="text-[18px] font-extrabold text-[var(--ink)]">Sent to {included.length} {included.length === 1 ? "family" : "families"}!</div>
          <p className="mx-auto mt-1.5 max-w-xs text-[13px] text-[var(--ink-3)]">Save this design to reuse it next time? Give it a name:</p>
          <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Summer camp email" className="mt-3 w-full rounded-lg border-2 border-[var(--line)] bg-white px-3.5 py-2.5 text-center text-[14px] font-semibold text-[var(--ink)] outline-none focus:border-[#3f78d8]" />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-[var(--line)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">No thanks</button>
            <button type="button" onClick={() => { saveCurrentDesign(); onCancel(); }} disabled={!saveName.trim()} className="flex-1 rounded-lg py-2.5 text-[13px] font-extrabold text-white shadow-sm disabled:opacity-40" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>Save it</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function useCampaignData() {
  const [rawBookings, setRawBookings] = useState<Booking[]>([]);
  const [rawListings, setRawListings] = useState<{ id: string; title: string; venueId?: string; runFrom?: string; runTo?: string }[]>([]);
  const [venueName, setVenueName] = useState<Record<string, string>>({}); // venueId → name
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [segments, setSegments] = useState<Audience[] | null>(null);
  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setRawBookings).catch(() => {}); }, []);
  // Live CRM segments, membership computed server-side at request time. The
  // "seg-" prefix keeps them in the composer's Segments optgroup. (The server's
  // "enquiries" segment — customer list, never booked — complements the
  // marked-from-inbox enquiry boards below; both are real, different sources.)
  useEffect(() => {
    apiGet<{ id: string; name: string; desc: string; count: number; emails: string[] }[]>("/api/emails/audiences")
      .then((s) => setSegments(s.filter((x) => x.id !== "all").map((x) => ({ ...x, id: `seg-${x.id}` }))))
      .catch(() => {});
  }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string; venueId?: string; runFrom?: string; runTo?: string }[]>("/api/listings?mine=1").then((l) => setRawListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing", venueId: x.venueId, runFrom: x.runFrom, runTo: x.runTo })))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ venues?: { id: string; name?: string; city?: string }[] } | null>("/api/library").then((lib) => setVenueName(Object.fromEntries((lib?.venues ?? []).map((v) => [v.id, v.name || v.city || "Venue"])))).catch(() => {}); }, []);
  useEffect(() => { apiGet<EmailTemplate[]>("/api/messages/templates").then(setTemplates).catch(() => setTemplates([])); }, []);
  // A listing's location = its venue's name. A booking inherits its listing's location.
  const listings = rawListings.map((l) => ({ ...l, location: l.venueId ? venueName[l.venueId] : undefined }));
  const locByListing = new Map(listings.map((l) => [l.id, l.location]));
  const bookings = rawBookings.map((b) => ({ ...b, locationName: b.locationName || locByListing.get(b.listingId || "") }));
  const locations = [...new Set([...listings.map((l) => l.location), ...bookings.map((b) => b.locationName)].filter((x): x is string => !!x))].sort();
  const allEmails = resolveAudience(bookings, {}).emails;
  const emailName = new Map<string, string>(); for (const b of bookings) { const e = b.email?.toLowerCase(); if (e && !emailName.has(e)) emailName.set(e, b.name || e); }
  const allAudience: Audience = { id: "all", name: "All active families", count: allEmails.length, emails: allEmails, people: allEmails.map((e) => ({ email: e, name: emailName.get(e.toLowerCase()) })), desc: "Has an active or upcoming booking" };
  const liveSegments = segments ?? [];
  return { bookings, listings, templates, locations, allAudience, liveSegments };
}

function CampaignsView({ onSent, seedAudienceId, onSeedConsumed, company, socials }: { onSent: () => void; seedAudienceId?: string | null; onSeedConsumed?: () => void; company?: Partial<Company>; socials?: Social[] }) {
  const { bookings, listings, templates, locations, allAudience, liveSegments } = useCampaignData();
  // Local rows hold the DESIGN (drafts + reusable content); live status,
  // delivery and opens come from the server records they link to.
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => (readLS<Campaign[] | null>(LS_CAMP, null) ?? []).filter((c) => !c.id.startsWith("seed")));
  const [hist, setHist] = useState<Sent[] | null>(null);
  const [sched, setSched] = useState<Scheduled[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState<Audience[]>(() => readLS<Audience[]>(LS_AUD, []));
  const [enquiries, setEnquiries] = useState<EnquiryRec[]>(() => readLS<EnquiryRec[]>(LS_ENQ, []));
  // If we arrived from an audience card's "Use in campaign", open straight into the locked composer.
  const [modal, setModal] = useState<null | "campaign" | "audience">(() => (seedAudienceId ? "campaign" : null));
  const [detail, setDetail] = useState<Campaign | null>(null);
  useEffect(() => { writeLS(LS_CAMP, campaigns); }, [campaigns]);
  useEffect(() => { writeLS(LS_AUD, custom); }, [custom]);
  const load = useCallback(() => {
    apiGet<Sent[]>("/api/emails").then(setHist).catch(() => setHist([]));
    apiGet<Scheduled[]>("/api/emails/scheduled").then(setSched).catch(() => setSched([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  const removeEnquiryPerson = (email: string) => setEnquiries((xs) => { const next = xs.filter((e) => e.email.toLowerCase() !== email.toLowerCase()); writeLS(LS_ENQ, next); return next; });
  const closeCampaign = () => { setModal(null); onSeedConsumed?.(); };
  const audiences = [allAudience, ...liveSegments, ...computeEnquiryAudiences(enquiries, bookings), ...custom];
  const create = async (c: { name: string; audience: Audience; template?: EmailTemplate; subject: string; html?: string; body?: string; design?: CampaignDesign; scheduledAt?: string }, action: CampStatus) => {
    setErr(null);
    const schedLabel = c.scheduledAt ? new Date(c.scheduledAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined;
    const row: Campaign = { id: `c${Date.now()}`, name: c.name, subtitle: c.template?.name ?? (c.html ? "Designed email" : undefined), audienceName: c.audience.name, recipients: c.audience.count, status: action, statusDate: action === "scheduled" ? schedLabel : action === "sent" ? "just now" : undefined, subject: c.subject, html: c.html, body: c.body, design: c.design, scheduledAt: c.scheduledAt, recipientEmails: c.audience.emails };
    if (action !== "draft" && !c.audience.emails.length) throw new Error("That audience has nobody in it yet — add recipients first.");
    // The send/queue is the server's; the local row keeps the design and
    // links to the server record for live status + open tracking. Errors
    // propagate to the modal so the reason is shown right where you clicked.
    if (action === "sent") {
      const r = await apiPost<{ id: string }>("/api/emails/send", { subject: c.subject || c.name, body: c.body || c.template?.body || c.subject || c.name, html: c.html, recipients: c.audience.emails });
      row.emailId = r.id;
      onSent();
    } else if (action === "scheduled") {
      const r = await apiPost<{ id: string }>("/api/emails/schedule", { subject: c.subject || c.name, body: c.body || c.template?.body || c.subject || c.name, html: c.html, recipients: c.audience.emails, sendAt: c.scheduledAt });
      row.schedId = r.id;
    }
    setCampaigns((xs) => [row, ...xs]); load();
    if (action !== "sent") closeCampaign();   // a send stays open so the modal can offer to save; scheduled/draft close now
  };
  // Live status/opens for linked rows, plus rows for server sends made
  // elsewhere (the composer, an earlier device) so nothing goes missing.
  const histById = new Map((hist ?? []).map((h) => [h.id, h]));
  const schedById = new Map((sched ?? []).map((s) => [s.id, s]));
  const linked = campaigns.map((c): Campaign => {
    const s = c.schedId ? schedById.get(c.schedId) : undefined;
    // A fired queue doc records the history id it became — follow the link.
    const h = histById.get(c.emailId ?? "") ?? (s?.emailId ? histById.get(s.emailId) : undefined);
    if (h) return { ...c, status: h.status === "sending" ? "sending" : "sent", statusDate: when(h.createdAt), recipients: h.recipientCount, delivered: h.delivered, opened: h.openedBy?.length, opens: h.delivered ? Math.round(((h.openedBy?.length ?? 0) / h.delivered) * 100) : undefined };
    if (s) return { ...c, status: s.status === "scheduled" ? "scheduled" : s.status === "sent" ? "sent" : "draft", statusDate: s.status === "cancelled" ? "cancelled" : whenSched(s.sendAt) };
    return c;
  });
  const knownEmailIds = new Set([
    ...campaigns.map((c) => c.emailId),
    // A fired queue doc's history id counts as covered by its campaign row.
    ...campaigns.map((c) => (c.schedId ? schedById.get(c.schedId)?.emailId : undefined)),
  ].filter(Boolean));
  const knownSchedIds = new Set(campaigns.map((c) => c.schedId).filter(Boolean));
  const serverOnly: Campaign[] = [
    ...(sched ?? []).filter((s) => s.status === "scheduled" && !knownSchedIds.has(s.id)).map((s): Campaign => ({ id: `sch-${s.id}`, schedId: s.id, name: s.subject, audienceName: "Recipient list frozen at schedule time", recipients: s.recipientCount, status: "scheduled", statusDate: whenSched(s.sendAt), subject: s.subject })),
    ...(hist ?? []).filter((h) => !knownEmailIds.has(h.id)).map((h): Campaign => ({ id: `h-${h.id}`, emailId: h.id, name: h.subject, audienceName: h.audience === "one" ? "One address" : "Families list", recipients: h.recipientCount, status: h.status === "sending" ? "sending" : "sent", statusDate: when(h.createdAt), subject: h.subject, delivered: h.delivered, opened: h.openedBy?.length, opens: h.delivered ? Math.round(((h.openedBy?.length ?? 0) / h.delivered) * 100) : undefined })),
  ];
  const allRows = [...linked, ...serverOnly];
  const cq = q.trim().toLowerCase();
  const rows = cq ? allRows.filter((c) => `${c.name} ${c.subtitle ?? ""} ${c.subject ?? ""} ${c.audienceName}`.toLowerCase().includes(cq)) : allRows;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-[13px] font-bold text-[var(--ink-2)]">Campaigns</span><div className="relative ml-2 max-w-xs flex-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns…" className="w-full rounded-full border border-[var(--line)] bg-white py-2 pl-9 pr-8 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />{q && <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--ink-3)] hover:text-[#c02636]">×</button>}</div><button type="button" onClick={() => setModal("campaign")} className="ml-auto rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>＋ New campaign</button></div>
      {err && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{err}</div>}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="grid grid-cols-[1.6fr_1.4fr_1fr_0.9fr_70px] gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><span>Campaign</span><span>Audience</span><span>Status</span><span>Opens</span><span></span></div>
        {rows.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{cq ? `No campaigns match “${q}”.` : "No campaigns yet."}</div>}
        {rows.map((c) => { const p = STATUS_PILL[c.status]; return (
          <div key={c.id} className="grid grid-cols-[1.6fr_1.4fr_1fr_0.9fr_70px] items-center gap-2 border-b border-[var(--line)] px-4 py-3 last:border-0">
            <div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{c.name}</div>{c.subtitle && <div className="truncate text-[12px] text-[var(--ink-3)]">{c.subtitle}</div>}</div>
            <div className="min-w-0"><div className="truncate text-[13px] text-[var(--ink-2)]">{c.audienceName}</div><div className="text-[12px] text-[var(--ink-3)]">{c.recipients} recipients</div></div>
            <div><span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold" style={{ background: p.bg, color: p.fg }}>● {p.label}</span>{c.statusDate && <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{c.statusDate}</div>}</div>
            <div>{c.opens != null ? <><div className="text-[15px] font-extrabold text-[var(--ink)]">{c.opens}%</div><div className="text-[12px] text-[var(--ink-3)]">{c.clicks ?? 0}% clicks</div></> : <span className="text-[var(--ink-3)]">—</span>}</div>
            <div className="text-right"><button type="button" onClick={() => setDetail(c)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Open</button></div>
          </div>
        ); })}
      </div>
      <div className="mt-3 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] px-3 py-2 text-[11.5px] text-[#1d3a8f]">Audiences are computed live from your bookings &amp; customer list. “Send now” and “Schedule” are real (cancel a scheduled send from Inbox → Scheduled); delivery and opens are tracked per send — opens via a pixel, so image-blocking clients won’t count.</div>
      {modal === "campaign" && <NewCampaign audiences={audiences} templates={templates} initialAudienceId={seedAudienceId} company={company} socials={socials} onCancel={closeCampaign} onSubmit={create} onRemovePerson={removeEnquiryPerson} />}
      {modal === "audience" && <AudienceBuilder bookings={bookings} listings={listings} locations={locations} onCancel={() => setModal("campaign")} onCreate={(a) => { setCustom((xs) => [...xs, a]); setModal("campaign"); }} />}
      {detail && <CampaignDetail c={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function CampaignDetail({ c, onClose }: { c: Campaign; onClose: () => void }) {
  // Real numbers from the send engine: delivered = accepted by the mail
  // transport, opened = distinct recipients whose client loaded the pixel.
  const tracked = c.status === "sent" && c.delivered != null;
  const sent = c.recipients;
  const delivered = c.delivered ?? (c.status === "sent" ? sent : 0);
  const opened = c.opened ?? 0;
  const bounces = tracked ? sent - delivered : 0;
  const p = STATUS_PILL[c.status];
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 border-b border-[var(--line)] px-5 py-4">
          <div><div className="text-[20px] font-extrabold text-[var(--ink)]">{c.name}</div><div className="text-[12.5px] text-[var(--ink-3)]">{[c.subtitle, c.audienceName, `${c.recipients} recipients`].filter(Boolean).join(" · ")}</div></div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold" style={{ background: p.bg, color: p.fg }}>● {p.label}</span>
        </div>
        <div className="max-h-[66vh] overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-3"><StatCard label="Open rate" value={tracked && delivered ? `${Math.round((opened / delivered) * 100)}%` : "—"} sub={tracked ? `${opened} of ${delivered}` : undefined} tone="#16a34a" /><StatCard label="Delivered" value={tracked ? String(delivered) : "—"} sub={tracked ? `of ${sent} sent` : undefined} tone="#16306e" /><StatCard label="Not delivered" value={tracked ? String(bounces) : "—"} tone="#ea580c" /></div>
          <div className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Delivery funnel</div>
          <div className="mt-2">
            <FunnelBar label="Sent" n={sent} max={sent} color="#6b7280" />
            <FunnelBar label="Delivered" n={delivered} max={sent} color="#16306e" />
            <FunnelBar label="Opened" n={opened} max={sent} color="#16a34a" />
          </div>
          <div className="mt-3 rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">Opens count once per recipient, via a tracking pixel — mail clients that block images won’t register. Click tracking (wrapped links) and one-click unsubscribe are still to come. {!tracked && <b>Numbers appear once this campaign has sent.</b>}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Close</button>
        </div>
      </div>
    </div>
  );
}

function AudSection({ title, hint }: { title: string; hint?: string }) {
  return <div className="mb-2 mt-4 first:mt-0"><div className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{title}</div>{hint && <div className="text-[11.5px] text-[var(--ink-3)]">{hint}</div>}</div>;
}
const AUD_ACCENT = {
  segments: "linear-gradient(180deg,#4f8bf5,#2f6bd8)",   // blue — core CRM segments
  enquiries: "linear-gradient(180deg,#e2586e,#c02a44)",  // red — warm leads to chase
  custom: "linear-gradient(180deg,#7b61e4,#5a3fc0)",     // violet — your own segments
} as const;
// Plain-English explanations for the built-in Groups (server descs are terse).
const SEG_DESCS: Record<string, string> = {
  "All active families": "Everyone with a booking on now or coming up — your main mailing list.",
  "Active families": "Families with a current or upcoming booking (live from your CRM).",
  "Past customers": "Have booked before but have nothing booked right now — perfect for a “we miss you” win-back email or a returning-family discount.",
  "Waitlisted": "On a waiting list or holding an unconfirmed offer for a place.",
  "New enquiries (no booking)": "On your customer list but have never booked — cold leads to convert.",
  "New enquiries — all": "Emailed you and you marked them as an enquiry, but they've never booked.",
};
function AudienceCard({ a, onUse, extra, accent = AUD_ACCENT.segments, onRemovePerson }: { a: Audience; onUse: (a: Audience) => void; extra?: React.ReactNode; accent?: string; onRemovePerson?: (email: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pq, setPq] = useState("");
  const allPeople = a.people?.length ? a.people : a.emails.map((e) => ({ email: e, name: undefined as string | undefined }));
  const people = pq.trim() ? allPeople.filter((p) => `${p.name ?? ""} ${p.email}`.toLowerCase().includes(pq.trim().toLowerCase())) : allPeople;
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex items-start justify-between gap-2"><span className="text-[15px] font-extrabold text-[var(--ink)]">{a.name}</span><span className="text-[22px] font-extrabold text-[#1d3a8f]" style={{ fontVariantNumeric: "tabular-nums" }}>{a.count}</span></div>
      <p className="mt-1 text-[12px] text-[var(--ink-3)]">{SEG_DESCS[a.name] ?? a.desc}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onUse(a)} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm" style={{ background: accent }}>Use in campaign</button>
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{open ? "▲ Hide" : `👁 View ${a.count}`}</button>
        {extra}
      </div>
      {open && (
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
          <style>{`.aud-scroll{overflow-y:scroll}.aud-scroll::-webkit-scrollbar{width:11px}.aud-scroll::-webkit-scrollbar-track{background:#eef1f6}.aud-scroll::-webkit-scrollbar-thumb{background:#9aa9c4;border-radius:6px;border:2px solid #eef1f6}`}</style>
          <div className="border-b border-[var(--line)] bg-[var(--panel)] p-2"><input value={pq} onChange={(e) => setPq(e.target.value)} placeholder={`🔍 Search ${allPeople.length} recipient${allPeople.length === 1 ? "" : "s"}…`} className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" /></div>
          <div className="aud-scroll h-52 bg-white">
            {people.length === 0 ? <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">{pq.trim() ? `No recipients match “${pq}”.` : "No recipients in this list."}</div>
              : people.map((p) => (
                  <div key={p.email} className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 last:border-0">
                    <div className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink)]">{p.name && p.name !== p.email ? <><b className="font-semibold">{p.name}</b> · </> : null}<span className="text-[var(--ink-3)]">{p.email}</span></div>
                    {onRemovePerson && <button type="button" title="Remove this person" onClick={() => { if (window.confirm(`Remove ${p.email} from this list?`)) onRemovePerson(p.email); }} className="flex-none text-[13px] font-bold text-[var(--ink-3)] hover:text-[#c02636]">✕</button>}
                  </div>
                ))}
          </div>
          {onRemovePerson && people.length > 0 && <button type="button" onClick={() => { if (window.confirm(`Remove ${pq.trim() ? "the " + people.length + " shown" : "all " + people.length} ${people.length === 1 ? "person" : "people"} from this list? This can’t be undone.`)) people.forEach((p) => onRemovePerson(p.email)); }} className="w-full border-t border-[#f2c4c9] bg-[#fdf0f1] py-2.5 text-[12px] font-extrabold text-[#c02636] hover:bg-[#fbe3e5]">🗑 Remove {pq.trim() ? `${people.length} shown` : `all ${people.length}`}</button>}
        </div>
      )}
    </div>
  );
}
function AudiencesView({ onUse, payMethods = [] }: { onUse: (a: Audience) => void; payMethods?: string[] }) {
  const { bookings, listings, locations, allAudience, liveSegments } = useCampaignData();
  const [enquiries, setEnquiries] = useState<EnquiryRec[]>(() => readLS<EnquiryRec[]>(LS_ENQ, []));
  useEffect(() => { writeLS(LS_ENQ, enquiries); }, [enquiries]);
  const removeEnquiryPerson = (email: string) => setEnquiries((xs) => xs.filter((e) => (e.email || "").toLowerCase() !== email.toLowerCase()));
  const [period, setPeriod] = useState<"30" | "90" | "all">("all");
  const [nowMs] = useState(() => Date.now());
  const [sub, setSub] = useState<"segments" | "enquiries">("enquiries");
  const [q, setQ] = useState("");
  const [enqLoc, setEnqLoc] = useState("all");
  const [segLoc, setSegLoc] = useState("");
  const [segListing, setSegListing] = useState("");
  const [segPay, setSegPay] = useState("");
  const [newDays, setNewDays] = useState(() => readLS<number>("aos.email.seg.newDays", 90));
  const [endDays, setEndDays] = useState(() => readLS<number>("aos.email.seg.endDays", 14));
  const [lapsedMonths, setLapsedMonths] = useState(() => readLS<number>("aos.email.seg.lapsedMonths", 6));
  useEffect(() => { writeLS("aos.email.seg.newDays", newDays); }, [newDays]);
  useEffect(() => { writeLS("aos.email.seg.endDays", endDays); }, [endDays]);
  useEffect(() => { writeLS("aos.email.seg.lapsedMonths", lapsedMonths); }, [lapsedMonths]);
  const ql = q.trim().toLowerCase();
  const matchAud = (a: Audience) => !ql || `${a.name} ${a.desc}`.toLowerCase().includes(ql);
  // Editable time window on the date-based Group cards — the count updates & saves automatically.
  const numBox = (val: number, set: (n: number) => void, min: number, max: number) => <input type="number" min={min} max={max} value={val} onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || min)))} className="w-14 rounded-md border border-[var(--line)] px-1.5 py-1 text-center text-[12px] font-bold text-[var(--ink)]" />;
  const periodEditor = (id: string): React.ReactNode => {
    if (id === "g-new") return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink-2)]">last {numBox(newDays, setNewDays, 7, 365)} days</span>;
    if (id === "g-ending") return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink-2)]">next {numBox(endDays, setEndDays, 1, 90)} days</span>;
    if (id === "g-lapsed") return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink-2)]">{numBox(lapsedMonths, setLapsedMonths, 1, 36)} months+</span>;
    return null;
  };
  const cutoff = period === "all" ? 0 : nowMs - Number(period) * 86_400_000;
  const enqInPeriod = enquiries.filter((e) => period === "all" || !e.at || Date.parse(e.at) >= cutoff);
  const enquiryAuds = computeEnquiryAudiences(enqInPeriod, bookings);
  const enqTotal = computeEnquiryAudiences(enquiries.filter((e) => e.email), bookings)[0]?.count ?? 0;
  // Hide server segments that duplicate the lead card (active families) or the Enquiries tab (never-booked).
  const HIDDEN_SEGS = new Set(["Active families", "All active families", "New enquiries (no booking)", "New enquiries"]);
  const groupSegs = liveSegments.filter((s) => !HIDDEN_SEGS.has(s.name));
  // Computed groups from bookings (client-side). Aggregate per family (email).
  const DAY = 86_400_000;
  const nameByEmail = new Map<string, string>();
  for (const b of bookings) { const e = b.email?.toLowerCase(); if (e && !nameByEmail.has(e)) nameByEmail.set(e, b.name || e); }
  type Agg = { first: number; last: number; futureAt: number; future: boolean; children: Set<string>; count: number };
  const agg = new Map<string, Agg>();
  for (const b of bookings) {
    const e = b.email?.toLowerCase(); if (!e) continue;
    const a = agg.get(e) ?? { first: Infinity, last: 0, futureAt: Infinity, future: false, children: new Set<string>(), count: 0 };
    a.count++;
    const made = bookedDate(b)?.getTime(); if (made != null) a.first = Math.min(a.first, made);
    const sd = sessionDate(b)?.getTime();
    if (sd != null) { a.last = Math.max(a.last, sd); if (sd >= nowMs) { a.future = true; a.futureAt = Math.min(a.futureAt, sd); } }
    if (b.child) a.children.add(b.child.toLowerCase());
    agg.set(e, a);
  }
  const mkGroup = (id: string, name: string, desc: string, pred: (a: Agg) => boolean): Audience => { const ems = [...agg].filter(([, a]) => pred(a)).map(([e]) => e); return { id, name, desc, count: ems.length, emails: ems, people: ems.map((e) => ({ email: e, name: nameByEmail.get(e) })) }; };
  const soonEnd = nowMs + endDays * DAY;
  const computedGroups: Audience[] = [
    mkGroup("g-new", `New this season`, `First booked in the last ${newDays} days — welcome them and upsell the next block.`, (a) => a.first !== Infinity && a.first >= nowMs - newDays * DAY),
    mkGroup("g-repeat", "Repeat families", "Have booked with you 2+ times — your loyal regulars.", (a) => a.count >= 2),
    mkGroup("g-multi", "Multi-child families", "Have 2+ children booked — sibling deals land well here.", (a) => a.children.size >= 2),
    mkGroup("g-ending", "Ending soon", `Have a session in the next ${endDays} days — perfect to sell the next block.`, (a) => a.last > 0 && a.futureAt >= nowMs && a.futureAt <= soonEnd),
    mkGroup("g-lapsed", "Lapsed families", `Last attended over ${lapsedMonths} months ago with nothing upcoming — win them back.`, (a) => a.last > 0 && a.last < nowMs - lapsedMonths * 30 * DAY && !a.future),
  ];
  const hasPayData = bookings.some((b) => !!b.method);
  const SUBS = [
    { k: "enquiries" as const, label: "📩 Enquiries", count: enqTotal },
    { k: "segments" as const, label: "👪 Booked parents", count: 1 + computedGroups.length + groupSegs.length },
  ];
  // Groups tab: build a live family group from the location + listing filters (both preset to "All").
  const segFiltered = !!(segLoc || segListing || segPay);
  const segTitle = listings.find((l) => l.id === segListing)?.title;
  const segFilterObj: AudFilter = { location: segLoc || undefined, listingIds: segListing ? [segListing] : undefined, paymentMethod: segPay || undefined };
  const segResolved = segFiltered ? resolveAudience(bookings, segFilterObj) : { emails: allAudience.emails, count: allAudience.count };
  const filteredAudience: Audience = segFiltered
    ? { id: "seg-filter", name: `Families${segLoc ? ` · ${segLoc}` : ""}${segTitle ? ` · ${segTitle}` : ""}${segPay ? ` · ${segPay}` : ""}`, count: segResolved.count, emails: segResolved.emails, desc: `Active or upcoming booking${segLoc ? ` in ${segLoc}` : ""}${segTitle ? ` on ${segTitle}` : ""}${segPay ? ` · paid by ${segPay}` : ""}`, filter: segFilterObj, people: segResolved.emails.map((e) => ({ email: e })) }
    : allAudience;
  return (
    <div>
      <div className="mb-3 rounded-lg border-l-4 border-[#2f6bd8] bg-[#eef4fd] px-3 py-2 text-[12px] text-[#1d3a8f]">✉ <b>Audiences are live CRM segments</b> — membership is recomputed from booking &amp; enrolment data each send, and opt-outs are always excluded.</div>
      <div className="relative mb-3 max-w-sm"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search audiences…" className="w-full rounded-full border border-[var(--line)] bg-white py-2 pl-9 pr-8 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />{q && <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--ink-3)] hover:text-[#c02636]">×</button>}</div>

      {/* switch between the three audience areas */}
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1">
        {SUBS.map((s) => <button key={s.k} type="button" onClick={() => setSub(s.k)} className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-extrabold transition ${sub === s.k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)] hover:text-[#1d3a8f]"}`}>{s.label}<span className={`rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums ${sub === s.k ? "bg-[#eef4fd] text-[#1d3a8f]" : "bg-[var(--line)] text-[var(--ink-3)]"}`}>{s.count}</span></button>)}
      </div>

      {sub === "segments" && (<>
        <AudSection title="🎯 Groups" hint="Ready-made groups that update themselves from your bookings & customer list — e.g. all families, or families on a given activity." />
        <div className="mb-4 rounded-2xl border border-[#cfe0f7] bg-white p-4 shadow-sm">
          <div className="mb-3 text-[14px] font-extrabold text-[#16306e]">🔎 Narrow by location, listing & payment</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">📍 Location</div><select value={segLoc} onChange={(e) => setSegLoc(e.target.value)} className="w-full rounded-xl border-2 border-[var(--line)] bg-white px-3.5 py-3 text-[15px] font-semibold text-[var(--ink)] outline-none focus:border-[#3f78d8]"><option value="">All locations</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
            <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">🎫 Listing</div><select value={segListing} onChange={(e) => setSegListing(e.target.value)} className="w-full rounded-xl border-2 border-[var(--line)] bg-white px-3.5 py-3 text-[15px] font-semibold text-[var(--ink)] outline-none focus:border-[#3f78d8]"><option value="">All listings</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></div>
            <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">💳 Payment method</div><select value={segPay} onChange={(e) => setSegPay(e.target.value)} className="w-full rounded-xl border-2 border-[var(--line)] bg-white px-3.5 py-3 text-[15px] font-semibold text-[var(--ink)] outline-none focus:border-[#3f78d8]"><option value="">Any method</option>{payMethods.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          </div>
          {!hasPayData && <p className="mt-2 text-[11px] text-[#9a6b00]">⚠ Options come from your <b>Setup → “How parents pay”</b> list. Filtering needs the method saved on each booking — it works the moment bookings include it (backend).</p>}
          {segFiltered && <div className="mt-3 flex items-center gap-2"><span className="rounded-lg bg-[#eef4fd] px-3 py-1.5 text-[13px] font-extrabold text-[#1d3a8f]">{filteredAudience.count} matching famil{filteredAudience.count === 1 ? "y" : "ies"}</span><button type="button" onClick={() => { setSegLoc(""); setSegListing(""); setSegPay(""); }} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[#c02636]">✕ Clear filters</button></div>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[filteredAudience, ...computedGroups, ...groupSegs].filter(matchAud).map((a) => <AudienceCard key={a.id} a={a} onUse={onUse} accent={AUD_ACCENT.segments} extra={periodEditor(a.id)} />)}</div>
      </>)}

      {sub === "enquiries" && (<>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AudSection title="📩 Enquiries — by location" hint="Emailed you but never booked. They drop off automatically once they book." />
          <div className="flex flex-wrap items-center gap-2">
            <select value={enqLoc} onChange={(e) => setEnqLoc(e.target.value)} title="Filter enquiries by location" className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)]"><option value="all">📍 All locations</option>{enquiryAuds.slice(1).map((a) => { const loc = a.name.replace(/^New enquiries · /, ""); return <option key={a.id} value={loc}>{loc} ({a.count})</option>; })}</select>
            <span className="text-[11.5px] font-bold text-[var(--ink-3)]">Enquired within</span><div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)] text-[12px] font-bold">{([["30", "Last 30d", "past 30 days"], ["90", "Last 90d", "past 90 days"], ["all", "All time", "ever"]] as const).map(([v, l, t]) => <button key={v} type="button" title={`Show enquiries received in the ${t}`} onClick={() => setPeriod(v)} className="px-3 py-1" style={period === v ? { background: "#eef4fd", color: "#1d3a8f" } : { color: "var(--ink-2)" }}>{l}</button>)}</div>
          </div>
        </div>
        <p className="mb-2 mt-1 text-[11.5px] text-[var(--ink-3)]">Filters this list by <b>how recently they first emailed you</b> — <b>Last 30d</b> shows only enquiries from the past month, <b>All time</b> shows everyone who ever enquired and still hasn&apos;t booked. Handy for chasing fresh leads vs. re-engaging old ones.</p>
        {enquiryAuds.length <= 1 && enquiryAuds[0]?.count === 0
          ? <div className="rounded-xl border border-dashed border-[var(--line)] bg-white p-5 text-center text-[12.5px] text-[var(--ink-3)]">No open enquiries. Open an email in the Inbox and hit <b>➕ Mark as enquiry</b> to add one.</div>
          : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(enqLoc === "all" ? enquiryAuds : enquiryAuds.filter((a) => a.name.replace(/^New enquiries · /, "") === enqLoc)).filter(matchAud).map((a) => <AudienceCard key={a.id} a={a} onUse={onUse} accent={AUD_ACCENT.enquiries} onRemovePerson={removeEnquiryPerson} />)}</div>}
      </>)}

    </div>
  );
}

interface EmailTemplate { id: string; name: string; subject?: string; body: string }
function TemplatesView({ onUse, company, socials }: { onUse: (t: EmailTemplate) => void; company?: Partial<Company>; socials?: Social[] }) {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [edit, setEdit] = useState<EmailTemplate | null>(null); // the one being edited/created
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Designed (builder) templates — the same ⭐ My templates store the campaign designer uses.
  const [designs, setDesigns] = useState<SavedTemplate[]>(() => loadMyTemplates());
  const [designer, setDesigner] = useState<{ mode: "new" } | { mode: "edit"; item: SavedTemplate } | null>(null);
  const [dNow] = useState(() => Date.now());
  const [sub, setSub] = useState<"worded" | "designed">("worded");
  const [q, setQ] = useState("");
  const saveDesign = (d: CampaignDesign) => {
    setDesigns((xs) => {
      let next: SavedTemplate[];
      if (designer?.mode === "edit") next = xs.map((x) => (x.id === designer.item.id ? { ...x, accent: d.accent, blocks: d.blocks } : x));
      else { const nm = window.prompt("Name this design template:", "My design") || "My design"; next = [{ id: `td-${dNow}-${xs.length}`, name: nm.trim() || "My design", accent: d.accent, blocks: d.blocks }, ...xs]; }
      persistMyTemplates(next); return next;
    });
    setDesigner(null);
  };
  const delDesign = (item: SavedTemplate) => { if (!confirm(`Delete the design “${item.name}”?`)) return; setDesigns((xs) => { const next = xs.filter((x) => x.id !== item.id); persistMyTemplates(next); return next; }); };
  const load = useCallback(() => apiGet<EmailTemplate[]>("/api/messages/templates").then(setTemplates).catch(() => setTemplates([])), []);
  useEffect(() => { load(); }, [load]);
  async function saveTmpl() {
    if (!edit || !edit.name.trim()) { setErr("Give the template a name."); return; }
    setBusy(true); setErr(null);
    const payload = { name: edit.name.trim(), subject: edit.subject?.trim() || undefined, body: edit.body };
    try {
      if (edit.id) await api(`/api/messages/templates/${encodeURIComponent(edit.id)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiPost("/api/messages/templates", payload);
      setEdit(null); load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save"); }
    finally { setBusy(false); }
  }
  async function del(t: EmailTemplate) {
    if (!confirm(`Delete the template “${t.name}”?`)) return;
    try { await api(`/api/messages/templates/${encodeURIComponent(t.id)}`, { method: "DELETE" }); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t delete"); }
  }
  if (!templates) return <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;
  const tq = q.trim().toLowerCase();
  const wShown = tq ? templates.filter((t) => `${t.name} ${t.subject ?? ""} ${t.body}`.toLowerCase().includes(tq)) : templates;
  const dShown = tq ? designs.filter((s) => s.name.toLowerCase().includes(tq)) : designs;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-xl border border-[var(--line)] bg-white text-[13px] font-bold shadow-sm">
          {([["worded", "✍️ Worded templates"], ["designed", `🎨 Builder templates${designs.length ? ` (${designs.length})` : ""}`]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setSub(k)} className="px-4 py-2.5" style={sub === k ? { background: "#eef4fd", color: "#1d3a8f" } : { color: "var(--ink-2)" }}>{l}</button>)}
        </div>
        <div className="relative max-w-xs flex-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="w-full rounded-full border border-[var(--line)] bg-white py-2 pl-9 pr-8 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />{q && <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--ink-3)] hover:text-[#c02636]">×</button>}</div>
      </div>
      {err && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{err}</div>}

      {sub === "worded" && <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-bold text-[var(--ink-2)]">Reusable worded templates — shared with Messages</span>
        <button type="button" onClick={() => setEdit({ id: "", name: "", subject: "", body: "" })} className="rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>＋ New template</button>
      </div>
      {wShown.length === 0 ? <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">{tq ? `No worded templates match “${q}”.` : "No templates yet. Create one — it’s available here and in Messages."}</Card>
      : <div className="flex flex-col gap-2">{wShown.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-bold text-[var(--ink)]">{t.name}</div>{t.subject && <div className="truncate text-[12px] text-[var(--ink-3)]">{t.subject}</div>}</div>
            <button type="button" onClick={() => onUse(t)} className="flex-none rounded-lg border border-[#2f6bd8] px-3 py-1.5 text-[12px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">Use</button>
            <button type="button" onClick={() => setEdit(t)} className="flex-none rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Edit</button>
            <button type="button" onClick={() => del(t)} className="flex-none rounded-lg border border-[#f6c9cc] px-3 py-1.5 text-[12px] font-bold text-[#c02636] hover:bg-[#fdebec]">Delete</button>
          </div>
        ))}</div>}
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">Tip: merge fields like {"{ChildName}"} / {"{ListingName}"} fill in automatically — in bulk Email sends each family’s fields resolve from their most relevant booking ({"{SessionDate}"}, {"{VenueName}"} included), with neutral wording for anyone we can’t match.</p>
      </>}

      {sub === "designed" && <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-bold text-[var(--ink-2)]">Build & save branded email designs — edit and save here, send from Campaigns</span>
        <button type="button" onClick={() => setDesigner({ mode: "new" })} className="rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>＋ New builder template</button>
      </div>
      {dShown.length === 0
        ? <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">{tq ? `No builder templates match “${q}”.` : <>No designs yet. Hit <b>＋ New builder template</b> to build one in the visual editor — it saves here and appears in Campaigns → Design your own → “Use a saved one”.</>}</Card>
        : <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>{dShown.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
              <div className="h-44 w-full overflow-hidden border-b border-[var(--line)] bg-white"><div style={{ width: 640, transform: "scale(0.375)", transformOrigin: "top left", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: renderDesignHtml({ accent: s.accent, blocks: s.blocks }, company, dNow) }} /></div>
              <div className="flex items-center gap-2 p-2.5"><div className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-[var(--ink)]">{s.name}</div><button type="button" onClick={() => setDesigner({ mode: "edit", item: s })} className="flex-none rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Edit</button><button type="button" onClick={() => delDesign(s)} className="flex-none rounded-lg border border-[#f6c9cc] px-2.5 py-1 text-[11.5px] font-bold text-[#c02636] hover:bg-[#fdebec]">Delete</button></div>
            </div>
          ))}</div>}
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">These are just for building &amp; saving — <b>to send</b> one, go to <b>Campaigns → New campaign → Design your own → Use a saved one</b>.</p>
      </>}
      {designer && <div className="relative z-[130]"><CampaignDesigner initial={designer.mode === "edit" ? { accent: designer.item.accent, blocks: designer.item.blocks } : null} company={company} socials={socials} onCancel={() => setDesigner(null)} onSave={saveDesign} saveLabel="💾 Save template" /></div>}

      {edit && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={() => setEdit(null)}>
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center border-b border-[var(--line)] px-5 py-3.5"><div className="text-[17px] font-extrabold text-[var(--ink)]">{edit.id ? "Edit template" : "New template"}</div><button type="button" onClick={() => setEdit(null)} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[var(--ink-3)] hover:bg-[var(--panel)]">×</button></div>
            <div className="max-h-[66vh] space-y-2.5 overflow-y-auto p-5">
              <div><FieldLabel>Name</FieldLabel><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Booking confirmation" className="w-full" /></div>
              <div><FieldLabel>Subject (optional)</FieldLabel><Input value={edit.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} placeholder="Subject line" className="w-full" /></div>
              <div><FieldLabel>Body</FieldLabel><textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={8} placeholder="Write the template… use {ChildName}, {ListingName} etc. for merge fields" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]" /><div className="mt-1 flex flex-wrap gap-1.5">{MERGE_FIELDS.map((f) => <button key={f.token} type="button" title={f.desc} onClick={() => setEdit((d) => d && ({ ...d, body: `${d.body}${d.body && !d.body.endsWith(" ") ? " " : ""}${f.token}` }))} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{f.token}</button>)}</div></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-3"><button type="button" onClick={() => setEdit(null)} className="rounded-lg border border-[var(--line)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button><button type="button" onClick={saveTmpl} disabled={busy} className="rounded-lg px-3.5 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-50" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{busy ? "Saving…" : "Save template"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsView() {
  // Straight off the send engine's records: recipientCount (sent), delivered
  // (accepted by the transport), openedBy (distinct pixel loads). Sends from
  // before delivery tracking carry no counts — treated as delivered.
  const [hist, setHist] = useState<Sent[] | null>(null);
  useEffect(() => { apiGet<Sent[]>("/api/emails").then(setHist).catch(() => setHist([])); }, []);
  const rows = (hist ?? []).map((h) => ({ ...h, deliveredN: h.delivered ?? (h.status === "sending" ? 0 : h.recipientCount), openedN: h.openedBy?.length ?? 0 }));
  const [sel, setSel] = useState<string>("all");
  const active = sel === "all" ? null : (rows.find((c) => c.id === sel) ?? null);
  const base = active ? [active] : rows;
  const sent = base.reduce((n, c) => n + c.recipientCount, 0);
  const delivered = base.reduce((n, c) => n + c.deliveredN, 0);
  const opened = base.reduce((n, c) => n + c.openedN, 0);
  const openRate = delivered ? Math.round((opened / delivered) * 100) : 0;
  const bounces = sent - delivered;
  return (
    <div>
      <div className="mb-3 rounded-lg border-l-4 border-[#2f6bd8] bg-[#eef4fd] px-3 py-2 text-[12px] text-[#1d3a8f]">✉ <b>Email analytics</b> — per send or across all. Delivery straight from the mail transport, opens from a once-per-recipient tracking pixel (image-blocking clients won’t count). Click tracking &amp; unsubscribes are still to come.</div>
      {/* campaign selector */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Campaign</span>
        <Select value={sel} onChange={(e) => setSel(e.target.value)} className="max-w-[340px] font-bold text-[#1d3a8f]">
          <option value="all">📊 All sends ({rows.length})</option>
          {rows.map((c) => <option key={c.id} value={c.id}>{c.subject} — {when(c.createdAt)}</option>)}
        </Select>
      </div>
      {active && <div className="mb-3 flex items-baseline gap-2"><span className="text-[16px] font-extrabold text-[var(--ink)]">{active.subject}</span><span className="ml-auto text-[12px] text-[var(--ink-3)]">{when(active.createdAt)}</span></div>}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Sent" value={String(sent)} sub={`${base.length} send${base.length === 1 ? "" : "s"}`} />
        <StatCard label="Delivered" value={String(delivered)} sub={sent ? `${Math.round((delivered / sent) * 100)}% of sent` : undefined} />
        <StatCard label="Open rate" value={`${openRate}%`} sub={`${opened} opened`} tone="#16a34a" />
        <StatCard label="Not delivered" value={String(bounces)} sub={sent ? `${Math.round((bounces / sent) * 100)}%` : undefined} tone="#ea580c" />
        <StatCard label="Click rate" value="—" sub="link tracking to come" />
      </div>
      {active
        ? <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="mb-3 text-[15px] font-extrabold text-[var(--ink)]">Delivery funnel</div>
            <div className="space-y-2.5">
              <FunnelBar label="Sent" n={sent} max={sent} color="#6b7280" />
              <FunnelBar label="Delivered" n={delivered} max={sent} color="#16306e" />
              <FunnelBar label="Opened" n={opened} max={sent} color="#16a34a" />
            </div>
          </div>
        : <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="mb-3 text-[15px] font-extrabold text-[var(--ink)]">Open rate by send <span className="text-[12px] font-normal text-[var(--ink-3)]">— tap one for its full breakdown</span></div>
            {rows.length === 0 ? <div className="py-4 text-center text-[13px] text-[var(--ink-3)]">No sends yet.</div>
            : rows.filter((c) => c.deliveredN > 0).slice(0, 10).map((c) => { const pct = Math.round((c.openedN / c.deliveredN) * 100); return (
              <button key={c.id} type="button" onClick={() => setSel(c.id)} className="mb-3 block w-full text-left last:mb-0"><div className="flex justify-between text-[13px]"><span className="truncate pr-3 text-[var(--ink-2)] hover:text-[#1d3a8f]">{c.subject}</span><span className="flex-none font-bold text-[var(--ink)]">{pct}% open</span></div><div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#16306e" }} /></div></button>
            ); })}
          </div>}
    </div>
  );
}

interface EmailSig { id: string; name: string; html: string }
function SignatureManager({ settings, save, onClose }: { settings: TenantSettings; save: (patch: { settings?: TenantSettings }) => Promise<void>; onClose: () => void }) {
  const sigs: EmailSig[] = settings.emailSignatures ?? [];
  const seq = useRef(0);
  const [draft, setDraft] = useState<EmailSig | null>(null);
  const b = settings.billing ?? {};
  const name = settings.providerName || b.businessName || "Your business";
  const fromDetails = () => `${b.logoUrl ? `<img src="${b.logoUrl}" alt="" style="max-height:64px"><br>` : ""}<b>${name}</b><br>${b.phone ? `Tel: ${b.phone}<br>` : ""}${b.email ? `Email: ${b.email}` : ""}`;
  const persist = (next: EmailSig[], def?: string) => save({ settings: { ...settings, emailSignatures: next, ...(def !== undefined ? { defaultSignatureId: def } : {}) } });
  const saveDraft = () => { if (!draft) return; const d = { ...draft, name: draft.name.trim() || "Signature" }; persist(sigs.some((s) => s.id === d.id) ? sigs.map((s) => s.id === d.id ? d : s) : [...sigs, d]); setDraft(null); };
  const del = (id: string) => { if (confirm("Delete this signature?")) persist(sigs.filter((s) => s.id !== id), settings.defaultSignatureId === id ? "" : undefined); };
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-[var(--line)] px-5 py-3.5"><div className="text-[17px] font-extrabold text-[var(--ink)]">Manage signatures</div><button type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[var(--ink-3)] hover:bg-[var(--panel)]">×</button></div>
        <div className="max-h-[66vh] overflow-y-auto p-5">
          {!draft ? (
            <>
              {sigs.length === 0 ? <p className="mb-3 text-[13px] text-[var(--ink-3)]">No signatures yet. Create one — your logo, business name and contact details, appended to the bottom of an email.</p>
              : <div className="mb-3 flex flex-col gap-2">{sigs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-3">
                    <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold text-[var(--ink)]">{s.name}{settings.defaultSignatureId === s.id && <span className="ml-2 rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-extrabold text-[#1d3a8f]">Default</span>}</div><div className="mt-1 max-h-16 overflow-hidden text-[11.5px] text-[var(--ink-3)]" dangerouslySetInnerHTML={{ __html: s.html }} /></div>
                    <div className="flex flex-none flex-col gap-1">
                      <button type="button" onClick={() => setDraft(s)} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Edit</button>
                      <button type="button" onClick={() => persist(sigs, settings.defaultSignatureId === s.id ? "" : s.id)} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{settings.defaultSignatureId === s.id ? "Unset default" : "Default"}</button>
                      <button type="button" onClick={() => del(s.id)} className="rounded-md border border-[#f6c9cc] px-2 py-0.5 text-[11px] font-bold text-[#c02636] hover:bg-[#fdebec]">Delete</button>
                    </div>
                  </div>
                ))}</div>}
              <button type="button" onClick={() => setDraft({ id: `sig-${sigs.length}-${seq.current++}`, name: "", html: fromDetails() })} className="rounded-lg px-3.5 py-2 text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>＋ New signature</button>
            </>
          ) : (
            <div className="space-y-2.5">
              <div><FieldLabel>Name</FieldLabel><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. LOGO" className="w-full" /></div>
              <div className="flex flex-wrap gap-2">
                {b.logoUrl && <button type="button" onClick={() => setDraft((d) => d && ({ ...d, html: `${d.html}<img src="${b.logoUrl}" alt="" style="max-height:64px"><br>` }))} className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">🖼 Insert logo</button>}
                <button type="button" onClick={() => setDraft((d) => d && ({ ...d, html: fromDetails() }))} className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">✨ Fill from my business details</button>
              </div>
              <div><FieldLabel>Signature</FieldLabel><RichText value={draft.html} onChange={(h) => setDraft((d) => d && ({ ...d, html: h }))} /></div>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-[var(--line)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button><button type="button" onClick={saveDraft} className="rounded-lg px-3.5 py-1.5 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>Save signature</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailPrefs({ settings, save }: { settings: TenantSettings; save: (patch: { settings?: TenantSettings }) => Promise<void> }) {
  const p = settings.emailPrefs ?? {};
  const sigs = settings.emailSignatures ?? [];
  const setP = (patch: Partial<NonNullable<TenantSettings["emailPrefs"]>>) => save({ settings: { ...settings, emailPrefs: { ...p, ...patch } } });
  const chip = (on: boolean) => on ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" };
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <Card className="p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">Undo send</div>
        <p className="mb-2 mt-0.5 text-[12px] text-[var(--ink-3)]">A grace period after you hit Send where you can still pull it back before it goes.</p>
        <div className="flex flex-wrap gap-1.5">{([[0, "Off"], [5, "5s"], [10, "10s"], [20, "20s"], [30, "30s"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setP({ undoSeconds: v })} className="rounded-full border px-3 py-1 text-[12.5px] font-bold" style={chip((p.undoSeconds ?? 5) === v)}>{l}</button>)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">Signature defaults</div>
        <p className="mb-2 mt-0.5 text-[12px] text-[var(--ink-3)]">Which signature is pre-selected. Manage the signatures themselves on the Compose tab.</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div><FieldLabel>On new emails</FieldLabel><Select value={settings.defaultSignatureId || "none"} onChange={(e) => save({ settings: { ...settings, defaultSignatureId: e.target.value === "none" ? "" : e.target.value } })} className="w-full"><option value="none">No signature</option>{sigs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <div><FieldLabel>On reply / forward</FieldLabel><Select value={p.replySignatureId || "none"} onChange={(e) => setP({ replySignatureId: e.target.value === "none" ? "" : e.target.value })} className="w-full"><option value="none">No signature</option>{sigs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">Default reply behaviour</div>
        <p className="mb-2 mt-0.5 text-[12px] text-[var(--ink-3)]">Which button leads when you open a message in the inbox.</p>
        <div className="flex flex-wrap gap-1.5">{([["reply", "Reply"], ["replyAll", "Reply all"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setP({ defaultReply: v })} className="rounded-full border px-3 py-1 text-[12.5px] font-bold" style={chip((p.defaultReply ?? "reply") === v)}>{l}</button>)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">Social links</div>
        <p className="mb-2.5 mt-0.5 text-[12px] text-[var(--ink-3)]">Enter your profiles once — they auto-fill the social row on every campaign template, so you never retype them.</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {([["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["twitter", "X / Twitter"], ["youtube", "YouTube"], ["website", "Website"]] as const).map(([net, label]) => (
            <div key={net}><FieldLabel>{label}</FieldLabel><Input value={(settings.social?.[net] as string) ?? ""} onChange={(e) => save({ settings: { ...settings, social: { ...settings.social, [net]: e.target.value } } })} placeholder={net === "website" ? "https://…" : "Profile URL"} className="w-full" /></div>
          ))}
        </div>
      </Card>
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
  const [recipQuery, setRecipQuery] = useState("");
  const [history, setHistory] = useState<Sent[] | null>(null);
  const [messages, setMessages] = useState<ServerMail[] | null>(null);
  const [scheduled, setScheduled] = useState<Scheduled[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [audience, setAudience] = useState<"all" | "one" | "listing" | "none">(presetTo ? "one" : "all");
  const [to, setTo] = useState(presetTo);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [extraTo, setExtraTo] = useState<string[]>([]); // addresses the operator typed in by hand
  const [extraInput, setExtraInput] = useState("");
  const [sigChoice, setSigChoice] = useState<string | null>(null); // null = follow default
  const [sigMgr, setSigMgr] = useState(false);
  const [replyTo, setReplyTo] = useState<{ name: string; email: string } | null>(null); // focused 1:1 reply mode
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedAt, setSchedAt] = useState("");
  const [undoSend, setUndoSend] = useState<{ payload: Record<string, unknown>; count: number; hadAttachments: boolean } | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);
  const undoFired = useRef(false);
  const [undoEnq, setUndoEnq] = useState<{ name: string; location?: string; prev: EnquiryRec[] } | null>(null);
  const [undoEnqLeft, setUndoEnqLeft] = useState(0);
  const [campaignSeedId, setCampaignSeedId] = useState<string | null>(null); // audience picked from a card's "Use in campaign"
  const [subject, setSubject] = useState(nlDraft?.subject ?? "");
  const [body, setBody] = useState(nlDraft?.body ? mdToHtml(nlDraft.body) : ""); // HTML (rich editor)
  const [attachments, setAttachments] = useState<{ name: string; size: string }[]>([]);
  const [listingIds, setListingIds] = useState<string[]>([]);
  const [composeListings, setComposeListings] = useState<{ id: string; title: string; venueId?: string }[]>([]);
  const [composeBookings, setComposeBookings] = useState<Booking[]>([]);
  const [venueName, setVenueName] = useState<Record<string, string>>({});
  const [composeTemplates, setComposeTemplates] = useState<EmailTemplate[]>([]);
  const [reach, setReach] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [moments, setMoments] = useState<LiveMoment[] | null>(null);
  const { settings, save } = useSettings();
  // Land on Compose when arriving from a hand-off (newsletter/register), else on
  // the Inbox (the manual's default Email view).
  type Tab = "inbox" | "campaigns" | "audiences" | "templates" | "automatic" | "analytics" | "compose" | "settings";
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

  // Append a plain-text block to the HTML body (converted to HTML).

  function patchImage(id: string, partial: Partial<SavedImage>) {
    save({ settings: { ...settings, emailAssets: { ...(settings.emailAssets ?? {}), images: savedImages.map((im) => im.id === id ? { ...im, ...partial } : im) } } });
  }
  function removeImage(id: string) {
    if (!confirm("Delete this photo from your Email library?\n\nThe original Moment isn’t affected — but you’d need to re-add it here to use it again.")) return;
    save({ settings: { ...settings, emailAssets: { ...(settings.emailAssets ?? {}), images: savedImages.filter((im) => im.id !== id) } } });
  }
  // Add the photo to the email draft as ONE composed image — the message + quote
  // baked in exactly like the Moments card, so the text is part of the picture
  // (not separate text below it). Embedded inline + resizable.
  async function addImageToEmail(im: SavedImage) {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const { caption, quotes } = resolveSavedText(im);
    let src = im.photoUrl, composed = false;
    // Try the Moments-style composed image (text baked in). If it can't be made or
    // hosted in a few seconds, fall back to the raw photo — never fail silently.
    try {
      const dataUrl = await Promise.race([
        composeMomentImage({ photoUrl: im.photoUrl, ratio: im.ratio, color: im.color, caption, quotes, footer: im.footer, fit: im.fit ?? "contain" }),
        new Promise<null>((r) => setTimeout(() => r(null), 4000)),
      ]);
      if (dataUrl) { composed = true; src = dataUrl; try { const r = await apiPost<{ url: string }>("/api/uploads", { dataUrl }); src = r.url; } catch { /* keep the data URL */ } }
    } catch { /* keep the raw photo */ }
    let block = `<img src="${src}" alt="${esc(im.childName ?? "photo")}" style="max-width:100%;border-radius:10px">`;
    if (!composed) { // raw photo — add the message/quote as text since it isn't baked in
      if (caption) block += `<div style="margin-top:6px">${esc(caption)}</div>`;
      for (const q of quotes) block += `<div style="color:#5f6672"><i>“${esc(q.text)}”</i> — ${esc(q.byName ?? "a parent")}</div>`;
    }
    setBody((b) => b.trim() ? `${b}<br><br>${block}` : block);
    setOk("✓ Photo added to your email — it’s in the message above with a size slider. Click a photo to resize it.");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const refresh = useCallback(() => {
    apiGet<Sent[]>("/api/emails").then((h) => { setHistory(h); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<ServerMail[]>("/api/emails/messages").then((m) => setMessages(m && m.length ? m : DEMO_INBOX)).catch(() => setMessages(DEMO_INBOX));
    apiGet<Scheduled[]>("/api/emails/scheduled").then(setScheduled).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // Consume the newsletter hand-off once so it doesn't re-fill on a later visit.
  useEffect(() => { try { localStorage.removeItem("aos.email.draft.v1"); } catch { /* private mode */ } }, []);
  const loadRecipients = useCallback(() => { apiGet<{ count: number; families?: { email: string; name: string }[] }>("/api/emails/recipients").then((r) => { setReach(r.count); setFamilies(r.families ?? []); }).catch(() => {}); }, []);
  useEffect(() => { loadRecipients(); }, [loadRecipients]);
  useEffect(() => { apiGet<LiveMoment[]>("/api/moments").then(setMoments).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string; venueId?: string }[]>("/api/listings?mine=1").then((l) => setComposeListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing", venueId: x.venueId })))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ venues?: { id: string; name?: string; city?: string }[] } | null>("/api/library").then((lib) => setVenueName(Object.fromEntries((lib?.venues ?? []).map((v) => [v.id, v.name || v.city || "Venue"])))).catch(() => {}); }, []);
  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setComposeBookings).catch(() => {}); }, []);
  useEffect(() => { apiGet<EmailTemplate[]>("/api/messages/templates").then(setComposeTemplates).catch(() => {}); }, []);
  useRealtime(["emails", "emailMessages", "scheduledEmails", "bookings", "moments"], () => { refresh(); loadRecipients(); apiGet<LiveMoment[]>("/api/moments").then(setMoments).catch(() => {}); });
  const included = families.filter((f) => !excluded.has(f.email));
  // Listing options for targeting: LIVE listings + any PAST listing still referenced
  // by a booking. Duplicating a listing makes a new id, so a parent booked on the
  // original would be missed if we only showed live listings — surface the old one
  // too, marked "past". A booking matches by id or by title.
  const listingOpts = (() => {
    const opts: { key: string; title: string; live: boolean }[] = composeListings.map((l) => ({ key: l.id, title: l.title, live: true }));
    const liveIds = new Set(composeListings.map((l) => l.id)); const liveTitles = new Set(composeListings.map((l) => l.title)); const seen = new Set<string>();
    for (const b of composeBookings) { const key = b.listingId || b.title || b.listingTitle; const title = b.title || b.listingTitle || key; if (!key || !title || liveIds.has(key) || liveTitles.has(title) || seen.has(key)) continue; seen.add(key); opts.push({ key, title, live: false }); }
    return opts;
  })();
  const bookingMatchesSel = (b: Booking) => listingIds.includes(b.listingId || "\0") || listingIds.includes(b.title || "\0") || listingIds.includes(b.listingTitle || "\0");
  // Recipients when targeting by listing: distinct emails booked on any selected
  // listing (a repeat parent across duplicated listings only appears once).
  const composeLocations = [...new Set(composeListings.map((l) => (l.venueId ? venueName[l.venueId] : undefined)).filter((x): x is string => !!x))].sort();
  const addEnquiry = (m: Mail, locations: string[]) => {
    const email = (m.fromEmail || "").toLowerCase();
    if (!email) { setError("This sender has no email address to save."); return; }
    const prev = readLS<EnquiryRec[]>(LS_ENQ, []);
    const at = new Date().toISOString().slice(0, 10);
    const wanted = locations.length ? locations : [undefined]; // no selection → one "no specific location" record
    const additions = wanted
      .filter((loc) => !prev.some((e) => e.email.toLowerCase() === email && (e.location || undefined) === (loc || undefined)))
      .map((loc) => ({ email, name: m.from, location: loc || undefined, at } as EnquiryRec));
    if (!additions.length) { setError(null); setOk(`${m.from} is already on ${locations.length ? "those enquiry boards" : "your New-enquiries board"}.`); return; }
    writeLS(LS_ENQ, [...additions, ...prev]);
    setError(null); setOk(null);
    setUndoEnq({ name: m.from, location: locations.join(", ") || undefined, prev }); setUndoEnqLeft(5);
  };
  const listingFamilies = (() => { const m = new Map<string, string>(); for (const b of composeBookings) { if (!b.email || !bookingMatchesSel(b)) continue; const e = b.email.toLowerCase(); if (!m.has(e)) m.set(e, b.name || b.email); } return [...m].map(([email, name]) => ({ email, name })); })();
  const listingEmails = listingFamilies.map((f) => f.email);
  const audienceFamilies = audience === "listing" ? listingFamilies : audience === "all" ? families : [];
  const audienceIncluded = audienceFamilies.filter((f) => !excluded.has(f.email));
  const reachCount = audience === "none" ? new Set([...extraTo, ...cc, ...bcc]).size : audience === "one" ? 1 : audienceFamilies.length ? audienceIncluded.length : reach ?? 0;
  const parseEmails = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
  const addExtra = () => { const parts = parseEmails(extraInput); if (parts.length) setExtraTo((xs) => [...new Set([...xs, ...parts])]); setExtraInput(""); };
  const addCc = () => { const p = parseEmails(ccInput); if (p.length) setCc((xs) => [...new Set([...xs, ...p])]); setCcInput(""); };
  const addBcc = () => { const p = parseEmails(bccInput); if (p.length) setBcc((xs) => [...new Set([...xs, ...p])]); setBccInput(""); };
  // A template is usable in Email only if every merge field it uses can resolve for
  // this send. Email is a bulk/no-booking context, so booking-scoped fields
  // ({SessionDate}, {VenueName}, {BookingRef}) can't be filled — those templates are
  // locked here and must be sent per-booking. ({ListingName} is OK on a listing send.)
  // Every template is usable: the send engine resolves merge fields PER
  // RECIPIENT at send time ({SessionDate}, {VenueName}, {BookingRef} etc. fill
  // from each family's most relevant booking, with neutral wording for a
  // family it can't match) — so booking-scoped templates are no longer locked.
  const emailAllowed = new Set(MERGE_FIELDS.map((f) => f.token.toLowerCase()));
  const emailKnown = new Set(MERGE_FIELDS.map((f) => f.token.toLowerCase()));
  const templateUsable = (t: EmailTemplate) => (`${t.subject ?? ""} ${t.body}`.match(/\{[A-Za-z]+\}/g) ?? []).map((x) => x.toLowerCase()).every((tok) => !emailKnown.has(tok) || emailAllowed.has(tok));
  // Signature: the operator's pick, or the tenant default until they choose.
  const signatures = settings.emailSignatures ?? [];
  const effSigId = sigChoice ?? settings.defaultSignatureId ?? "";
  const selectedSig = signatures.find((s) => s.id === effSigId) ?? null;
  // The "designed" version families can get as embedded HTML or a PDF: a newsletter
  // hand-off (docHtml), or — for a plain compose — the body once it has photos/rich
  // formatting, so a photo email can also be embedded or attached as a PDF.
  const bodyHasMedia = /<(img|h3|blockquote|ul|ol)[\s>]/i.test(body);
  const designedDoc = docHtml || (bodyHasMedia ? body : "");
  // Insert an uploaded image inline into the rich body.
  async function insertPhoto(f: File) {
    try {
      const small = await downscaleImage(f);
      const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl: small });
      setBody((bd) => `${bd}<img src="${url}" alt="" style="max-width:100%;border-radius:8px"><br>`);
      setOk("✓ Photo added — it’s in the message above with a size slider.");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError("Couldn’t add that photo — try a smaller JPG or PNG."); }
  }
  // "Help me write" — draft/extend the email body from a short brief via the AI writer.
  const [aiBusy, setAiBusy] = useState(false);
  async function aiWrite() {
    const notes = window.prompt("What should this email say? A line or two — the writer turns it into a friendly email.");
    if (!notes?.trim()) return;
    setAiBusy(true); setError(null);
    try {
      const r = await apiPost<{ title: string; body: string }>("/api/ai/compose", { kind: "announce", notes: notes.trim(), length: "medium" });
      if (r.title && !subject.trim()) setSubject(r.title);
      if (r.body) setBody((bd) => bd.trim() ? `${bd}<br><br>${mdToHtml(r.body)}` : mdToHtml(r.body));
    } catch (e) { setError(e instanceof Error ? e.message : "The writer couldn’t draft that — try again."); }
    finally { setAiBusy(false); }
  }

  const addAttachment = (f: File) => { const kb = Math.max(1, Math.round(f.size / 1024)); setAttachments((xs) => [...xs, { name: f.name, size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB` }]); };

  // The exact list this send will go to: the chosen audience (minus anyone removed)
  // plus any addresses the operator typed in by hand, de-duplicated.
  const finalRecipients = (() => {
    const base = audience === "none" ? []
      : audience === "one" ? (to.trim() ? [to.trim().toLowerCase()] : [])
      : audienceIncluded.map((f) => f.email.toLowerCase());
    return [...new Set([...base, ...extraTo, ...cc, ...bcc])].filter(Boolean);
  })();

  // Fire the actual API send with a snapshotted payload, then clear the composer.
  const dispatchSend = useCallback(async (payload: Record<string, unknown>, hadAttachments: boolean) => {
    setSending(true); setError(null); setOk(null);
    try {
      const r = await apiPost<{ recipientCount: number }>("/api/emails/send", payload);
      setOk(`Sent to ${r.recipientCount} recipient${r.recipientCount === 1 ? "" : "s"}.${hadAttachments ? " (Attachments send once file-attach is wired on the backend.)" : ""}`);
      setSubject(""); setBody(""); setTo(""); setCc([]); setBcc([]); setCcInput(""); setBccInput(""); setExtraTo([]); setAttachments([]); setReplyTo(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send"); }
    finally { setSending(false); }
  }, [refresh]);

  // Undo-send window: tick down, then fire the queued send once (Undo cancels it).
  useEffect(() => {
    if (!undoSend) { undoFired.current = false; return; }
    if (undoLeft > 0) { const t = setTimeout(() => setUndoLeft((n) => n - 1), 1000); return () => clearTimeout(t); }
    if (!undoFired.current) { undoFired.current = true; const u = undoSend; setUndoSend(null); void dispatchSend(u.payload, u.hadAttachments); }
  }, [undoSend, undoLeft, dispatchSend]);

  // Undo-enquiry window: the add already happened; tick down, then dismiss.
  useEffect(() => {
    if (!undoEnq) return;
    const t = setTimeout(() => { if (undoEnqLeft <= 1) setUndoEnq(null); else setUndoEnqLeft((n) => n - 1); }, 1000);
    return () => clearTimeout(t);
  }, [undoEnq, undoEnqLeft]);

  function send() {
    const bodyText = htmlToText(body);
    if (!subject.trim() || !bodyText.trim()) { setError("A subject and a message are required."); return; }
    if (audience === "one" && !to.trim() && extraTo.length === 0) { setError("Enter a recipient address."); return; }
    if (audience === "listing" && listingIds.length === 0) { setError("Pick at least one listing to email."); return; }
    const count = finalRecipients.length;
    if (count === 0) { setError("No recipients selected to send to."); return; }
    const payload: Record<string, unknown> = {
      subject, body: bodyText + (selectedSig ? `\n\n${htmlToText(selectedSig.html)}` : ""),
      html: (docHtml && mode === "embed" ? docHtml : body) + (selectedSig ? `<br><br>${selectedSig.html}` : ""),
      // "one" is recorded as such in the history ("Sent to 1 address");
      // everything else sends the explicit recipient list.
      audience: audience === "one" && finalRecipients.length === 1 ? "one" : "all",
      ...(audience === "one" && finalRecipients.length === 1 ? { to: finalRecipients[0] } : {}),
      recipients: finalRecipients, cc: cc.length ? cc.join(",") : undefined, bcc: bcc.length ? bcc.join(",") : undefined,
    };
    const secs = settings.emailPrefs?.undoSeconds ?? 0;   // instant send by default; opt into a grace period in Settings
    if (secs > 0) { setError(null); setOk(null); setUndoSend({ payload, count, hadAttachments: attachments.length > 0 }); setUndoLeft(secs); return; }
    if (!confirm(`Send this email to ${count} recipient${count === 1 ? "" : "s"}?`)) return;
    void dispatchSend(payload, attachments.length > 0);
  }

  // Schedule the email for later: the full composed payload is queued
  // server-side and a background job fires it at sendAt. Cancellable from the
  // Inbox → Scheduled folder until then.
  async function scheduleSend() {
    const bodyText = htmlToText(body);
    if (!subject.trim() || !bodyText.trim()) { setError("A subject and a message are required."); return; }
    if (finalRecipients.length === 0) { setError("No recipients selected to send to."); return; }
    if (!schedAt || new Date(schedAt) <= new Date()) { setError("Pick a future date & time to schedule."); return; }
    setSending(true); setError(null); setOk(null);
    try {
      await apiPost("/api/emails/schedule", {
        subject, body: bodyText + (selectedSig ? `\n\n${htmlToText(selectedSig.html)}` : ""),
        html: (docHtml && mode === "embed" ? docHtml : body) + (selectedSig ? `<br><br>${selectedSig.html}` : ""),
        audience: "all", recipients: finalRecipients,
        cc: cc.length ? cc.join(",") : undefined, bcc: bcc.length ? bcc.join(",") : undefined,
        sendAt: schedAt,
      });
      setOk(`Scheduled for ${whenSched(schedAt)} — you can cancel it from Inbox → Scheduled until it sends.`);
      setSchedOpen(false); setSubject(""); setBody(""); setTo(""); setCc([]); setBcc([]); setCcInput(""); setBccInput(""); setExtraTo([]); setAttachments([]); setSchedAt(""); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t schedule"); }
    finally { setSending(false); }
  }

  return (
    <OperatorPage title="Email" icon="✉️" lede="Your inbox, campaigns and the emails ActivityOS sends for you — all in one place.">
      <TabStrip<Tab> tabs={[["inbox", "Inbox"], ["compose", "Compose"], ["campaigns", "Campaigns"], ["audiences", "Audiences"], ["templates", "Templates"], ["automatic", "Automatic emails"], ["analytics", "Analytics"], ["settings", "Settings"]]} value={tab} onChange={setTab} />
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}
      {undoEnq && (
        <div className="fixed bottom-6 left-1/2 z-[140] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#bfe6cf] bg-white px-4 py-3 shadow-[0_12px_40px_-8px_rgba(18,122,62,.4)]">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[14px] text-white shadow-sm" style={{ background: "linear-gradient(180deg,#33b06a,#127a3e)" }}>✓</span>
          <span className="text-[13px] font-semibold text-[var(--ink)]">Added <b>{undoEnq.name}</b> to New enquiries{undoEnq.location ? <> · <b>{undoEnq.location}</b></> : ""}</span>
          <span className="relative flex h-7 w-7 flex-none items-center justify-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="#eafaf0" strokeWidth="4" /><circle cx="18" cy="18" r="15" fill="none" stroke="#127a3e" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - undoEnqLeft / 5)} style={{ transition: "stroke-dashoffset 1s linear" }} /></svg>
            <span className="text-[11px] font-extrabold tabular-nums text-[#127a3e]">{undoEnqLeft}</span>
          </span>
          <button type="button" onClick={() => { writeLS(LS_ENQ, undoEnq.prev); setUndoEnq(null); setUndoEnqLeft(0); setOk("Undone — not added to enquiries."); }} className="flex-none rounded-lg px-3.5 py-1.5 text-[12.5px] font-extrabold text-white shadow-sm" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>↩ Undo</button>
        </div>
      )}

      {tab === "inbox" && <InboxView history={history} messages={messages} scheduled={scheduled} onRefresh={refresh} locations={composeLocations} onEnquiry={addEnquiry} onCompose={() => { setReplyTo(null); setTab("compose"); }} onReply={(m) => { setAudience("one"); if (m.fromEmail) setTo(m.fromEmail); setReplyTo({ name: m.from, email: m.fromEmail ?? "" }); setSubject(`Re: ${m.subject}`); setBody(mdToHtml(`\n\n———\n${m.from} wrote:\n${m.body ?? m.preview}`)); setSigChoice(settings.emailPrefs?.replySignatureId ?? ""); setTab("compose"); }} onQuickReply={(m, text) => { setAudience("one"); if (m.fromEmail) setTo(m.fromEmail); setReplyTo({ name: m.from, email: m.fromEmail ?? "" }); setSubject(`Re: ${m.subject}`); setBody(mdToHtml(text)); setSigChoice(settings.emailPrefs?.replySignatureId ?? ""); setTab("compose"); }} onForward={(m) => { setAudience("one"); setTo(""); setReplyTo(null); setSubject(`Fwd: ${m.subject}`); setBody(mdToHtml(`\n\n———\nForwarded from ${m.from}:\n${m.body ?? m.preview}`)); setSigChoice(settings.emailPrefs?.replySignatureId ?? ""); setTab("compose"); }} />}
      {tab === "campaigns" && <CampaignsView onSent={refresh} seedAudienceId={campaignSeedId} onSeedConsumed={() => setCampaignSeedId(null)} company={{ name: settings.providerName || settings.billing?.businessName || "", phone: settings.billing?.phone, email: settings.billing?.email, address: settings.billing?.address, logo: settings.billing?.logoUrl }} socials={Object.entries(settings.social ?? {}).filter(([, v]) => v).map(([net, url]) => ({ net, url: url as string }))} />}
      {tab === "audiences" && <AudiencesView onUse={(a) => { setCampaignSeedId(a.id); setTab("campaigns"); }} payMethods={settings.payMethods ?? []} />}
      {tab === "templates" && <TemplatesView onUse={(t) => { setSubject(t.subject ?? ""); setBody(mdToHtml(t.body)); setTab("compose"); }} company={{ name: settings.providerName || settings.billing?.businessName || "", phone: settings.billing?.phone, email: settings.billing?.email, address: settings.billing?.address, logo: settings.billing?.logoUrl }} socials={Object.entries(settings.social ?? {}).filter(([, v]) => v).map(([net, url]) => ({ net, url: url as string }))} />}
      {tab === "analytics" && <AnalyticsView />}
      {tab === "automatic" && <AutoEmails settings={settings} save={save} />}
      {tab === "settings" && <EmailPrefs settings={settings} save={save} />}

      {tab === "compose" && (<>
      {undoSend && <div className="mb-3 flex items-center gap-3 rounded-lg border border-[#dbe6fb] bg-[#eaf0fc] px-3 py-2 text-[12.5px] font-semibold text-[#1d3a8f]"><span>Sending to {undoSend.count} recipient{undoSend.count === 1 ? "" : "s"} in {undoLeft}s…</span><button type="button" onClick={() => { setUndoSend(null); setUndoLeft(0); setOk("Send cancelled — your draft is still here."); }} className="ml-auto rounded-md bg-white px-3 py-1 text-[12px] font-extrabold text-[#1d3a8f] shadow-sm">↩ Undo</button></div>}
      {designedDoc && (
        <div className="mb-4 rounded-2xl border-2 border-[#2f6bd8] bg-[#f4f8ff] p-4">
          <div className="text-[14px] font-extrabold text-[#1d3a8f]">{docHtml ? "📰 A designed newsletter came from the Newsfeed — how should families get it?" : "🖼 This email has photos / formatting — how should families get it?"}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["embed", "📧 Embed it inside the email (HTML)"], ["attach", "📎 Attach it as a PDF"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => setMode(k)} className="rounded-lg border-2 px-3.5 py-2 text-[13px] font-extrabold" style={mode === k ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{mode === k ? "✓ " : ""}{label}</button>)}
            <button type="button" onClick={() => printDocHtml(designedDoc)} className="ml-auto rounded-lg border border-[#1d3a8f] px-3 py-2 text-[12.5px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">⬇ Preview / download PDF</button>
          </div>
          <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">{mode === "embed" ? "Families get the full layout (photos + formatting) in the email body." : <span>Families get a short covering email with it attached as a PDF. <b className="text-[#8a6d1a]">Auto-attach is a backend step — grab the PDF here for now.</b></span>}</div>
        </div>
      )}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/15 text-[17px]">✉️</span>
          <div><div className="text-[14.5px] font-extrabold">Compose your email</div><div className="text-[11.5px] text-white/80">Choose who gets it, write your message, then send or schedule.</div></div>
        </div>
        <div className="p-4">
        {replyTo ? (
          <div className="rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#3f78d8,#16306e)" }}>{replyTo.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              <span className="text-[13px] font-bold text-[var(--ink)]">↩ Reply to {replyTo.name}</span>
              {replyTo.email && <span className="text-[12px] text-[var(--ink-3)]">{replyTo.email}</span>}
              <button type="button" onClick={() => setReplyTo(null)} className="ml-auto text-[11.5px] font-bold text-[#1d3a8f]">Send to more people →</button>
            </div>
            <div className="mt-2"><FieldLabel>To</FieldLabel><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="w-full" /></div>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <FieldLabel>Audience</FieldLabel>
              <Select value={audience} onChange={(e) => setAudience(e.target.value as "all" | "one" | "listing" | "none")} className="w-full">
                <option value="all">All families ({families.length ? included.length : reach ?? 0})</option>
                <option value="listing">Families on a listing</option>
                <option value="one">A single address</option>
                <option value="none">None — I&apos;ll add recipients myself</option>
              </Select>
            </div>
            {audience === "one" && <div><FieldLabel>Recipient</FieldLabel><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="w-full" /></div>}
          </div>
        )}
        {audience === "listing" && (
          <div className="mt-2">
            <FieldLabel>Listings — everyone booked on the ones you pick ({listingEmails.length})</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {listingOpts.length === 0 ? <span className="text-[11.5px] text-[var(--ink-3)]">No listings yet.</span>
                : listingOpts.map((l) => { const on = listingIds.includes(l.key); return <button key={l.key} type="button" onClick={() => setListingIds((xs) => on ? xs.filter((x) => x !== l.key) : [...xs, l.key])} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={on ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{l.title}{!l.live && <span className="ml-1 text-[10px] font-semibold text-[var(--ink-3)]">· past</span>}</button>; })}
            </div>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">Includes past listings still linked to bookings — so parents from a listing you’ve since duplicated aren’t missed. Repeat parents are only emailed once.</p>
          </div>
        )}
        {audience !== "one" && reachCount > 1 && <p className="mt-2 text-[11.5px] font-semibold text-[#127a3e]">✓ Each family gets their own copy — recipients never see each other’s email address.</p>}
        <div className="mt-2">
          {showCcBcc ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div><FieldLabel>Cc</FieldLabel><div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5">{cc.map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[#eef4fd] px-2 py-0.5 text-[12px] font-bold text-[#1d3a8f]">{e}<button type="button" onClick={() => setCc((xs) => xs.filter((x) => x !== e))} className="text-[#1d3a8f]">×</button></span>)}<input value={ccInput} onChange={(e) => setCcInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCc(); } }} onBlur={addCc} placeholder="cc@example.com — Enter to add" className="min-w-[130px] flex-1 bg-transparent px-1.5 py-1 text-[12.5px] outline-none" /></div></div>
              <div><FieldLabel>Bcc</FieldLabel><div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5">{bcc.map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[#eef4fd] px-2 py-0.5 text-[12px] font-bold text-[#1d3a8f]">{e}<button type="button" onClick={() => setBcc((xs) => xs.filter((x) => x !== e))} className="text-[#1d3a8f]">×</button></span>)}<input value={bccInput} onChange={(e) => setBccInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addBcc(); } }} onBlur={addBcc} placeholder="bcc@example.com — Enter to add" className="min-w-[130px] flex-1 bg-transparent px-1.5 py-1 text-[12.5px] outline-none" /></div></div>
            </div>
          ) : <button type="button" onClick={() => setShowCcBcc(true)} className="text-[12px] font-bold text-[#1d3a8f]">＋ Add Cc / Bcc</button>}
        </div>
        {!replyTo && (
          <div className="mt-2">
            <FieldLabel>Also send to — add anyone (yourself, a colleague…)</FieldLabel>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5">
              {extraTo.map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[#eef4fd] px-2 py-0.5 text-[12px] font-bold text-[#1d3a8f]">{e}<button type="button" onClick={() => setExtraTo((xs) => xs.filter((x) => x !== e))} className="text-[#1d3a8f]">×</button></span>)}
              <input value={extraInput} onChange={(e) => setExtraInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addExtra(); } }} onBlur={addExtra} placeholder="name@example.com — Enter to add" className="min-w-[180px] flex-1 bg-transparent px-1.5 py-1 text-[12.5px] outline-none" />
            </div>
          </div>
        )}
        {audience !== "one" && audienceFamilies.length > 0 && (
          <div className="mt-2">
            <button type="button" onClick={() => setRecipOpen((o) => !o)} className="text-[12px] font-bold text-[#1d3a8f]">{recipOpen ? "▾" : "▸"} Review the {reachCount} famil{reachCount === 1 ? "y" : "ies"} who’ll get this</button>
            {recipOpen && (() => { const q = recipQuery.trim().toLowerCase(); const shown = q ? audienceFamilies.filter((f) => `${f.name} ${f.email}`.toLowerCase().includes(q)) : audienceFamilies; return (
              <div className="mt-1.5 rounded-lg border border-[var(--line)]">
                <div className="border-b border-[var(--line)] p-1.5"><input value={recipQuery} onChange={(e) => setRecipQuery(e.target.value)} placeholder="🔍 Search families by name or email…" className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#2f6bd8]" /></div>
                <div className="max-h-56 divide-y divide-[var(--line)] overflow-auto">
                  {shown.length === 0 ? <div className="px-3 py-4 text-center text-[12px] text-[var(--ink-3)]">No families match “{recipQuery.trim()}”.</div>
                  : shown.map((f) => { const on = !excluded.has(f.email); return (
                    <div key={f.email} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]" style={on ? undefined : { opacity: 0.5 }}>
                      <span className="min-w-0 flex-1 truncate"><b>{f.name}</b> <span className="text-[var(--ink-3)]">{f.email}</span></span>
                      <button type="button" onClick={() => setExcluded((s) => { const n = new Set(s); if (on) n.add(f.email); else n.delete(f.email); return n; })} className="flex-none rounded-md border px-2 py-0.5 text-[11px] font-bold" style={on ? { borderColor: "var(--line)", color: "var(--ink-2)" } : { borderColor: "#1d3a8f", color: "#1d3a8f" }}>{on ? "Remove" : "Add back"}</button>
                    </div>
                  ); })}
                </div>
              </div>
            ); })()}
          </div>
        )}
        <div className="-mx-4 my-3.5 flex items-center gap-2 border-t border-[var(--line)] bg-[#f7f9fc] px-4 py-2"><span className="text-[13px]">✏️</span><span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">Your message</span></div>
        <div className="mt-2.5"><FieldLabel>Subject</FieldLabel><Input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full" /></div>
        <div className="mt-2.5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><FieldLabel>Message</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={aiWrite} disabled={aiBusy} className="rounded-md border border-[#7c3aed] px-2 py-1 text-[12px] font-extrabold text-[#7c3aed] hover:bg-[#f5f0ff] disabled:opacity-50">{aiBusy ? "✨ Writing…" : "✨ Help me write"}</button>
              <label title="Insert a photo into the email" className="cursor-pointer rounded-md border border-[var(--line)] px-2 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">🖼 Photo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void insertPhoto(f); e.target.value = ""; }} /></label>
              <label title="Attach a file — images are embedded (resizable); other files attach" className="cursor-pointer rounded-md border border-[var(--line)] px-2 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">📎 Attach<input type="file" multiple className="hidden" onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => { if (f.type.startsWith("image/") && confirm(`“${f.name}” is an image — embed it in the email? (Cancel = attach as a file instead.)`)) void insertPhoto(f); else addAttachment(f); }); e.target.value = ""; }} /></label>
              {composeTemplates.length > 0 && <Select value="" onChange={(e) => { const t = composeTemplates.find((x) => x.id === e.target.value); if (t && templateUsable(t)) { if (t.subject && !subject.trim()) setSubject(t.subject); setBody((b) => b.trim() ? `${b}<br><br>${mdToHtml(t.body)}` : mdToHtml(t.body)); } }} className="text-[12px]"><option value="">＋ Insert template…</option>{composeTemplates.map((t) => { const ok = templateUsable(t); return <option key={t.id} value={t.id} disabled={!ok}>{t.name}{ok ? "" : " · per-booking only"}</option>; })}</Select>}
            </div>
          </div>
          <RichText value={body} onChange={setBody} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">✒ Signature</span>
            <Select value={selectedSig ? selectedSig.id : "none"} onChange={(e) => { const v = e.target.value; if (v === "__manage") { setSigMgr(true); return; } setSigChoice(v === "none" ? "" : v); }} className="text-[12px]">
              <option value="none">No signature</option>
              {signatures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__manage">Manage signatures…</option>
            </Select>
          </div>
          {selectedSig && <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3"><div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Signature added to the bottom</div><div className="text-[12.5px] text-[var(--ink-2)]" dangerouslySetInnerHTML={{ __html: selectedSig.html }} /></div>}
          {attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[12px] font-bold">📎 {a.name} <span className="font-normal text-[var(--ink-3)]">{a.size}</span><button type="button" onClick={() => setAttachments((xs) => xs.filter((_, j) => j !== i))} className="text-[var(--ink-3)] hover:text-[#c02636]">×</button></span>)}</div>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="relative inline-flex">
            <button type="button" onClick={send} disabled={sending} className="rounded-l-lg bg-[#1d3a8f] px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-50">{sending ? "Sending…" : `Send to ${finalRecipients.length} recipient${finalRecipients.length === 1 ? "" : "s"}`}</button>
            <button type="button" onClick={() => setSchedOpen((o) => !o)} disabled={sending} aria-label="Schedule send" className="rounded-r-lg border-l border-white/30 bg-[#1d3a8f] px-2.5 py-2 text-[12px] font-bold text-white disabled:opacity-50">▲</button>
            {schedOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-1.5 w-72 rounded-xl border border-[var(--line)] bg-white p-3 shadow-xl">
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-extrabold text-[var(--ink)]">📣 Schedule send</div>
                <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#2f6bd8]" />
                <div className="mt-2 flex gap-2"><button type="button" onClick={scheduleSend} className="flex-1 rounded-md bg-[#1d3a8f] px-3 py-1.5 text-[12.5px] font-extrabold text-white">Schedule</button><button type="button" onClick={() => setSchedOpen(false)} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button></div>
                <div className="mt-1.5 text-[10.5px] text-[var(--ink-3)]">Held in a queue; the timed send runs on the backend.</div>
              </div>
            )}
          </div>
          {reachCount === 0 && extraTo.length === 0 && audience !== "one" && <span className="text-[11.5px] text-[var(--ink-3)]">No recipients yet.</span>}
        </div>
        </div>
      </Card>

      {savedImages.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#f6e2a8] bg-[#fffdf3] p-3.5">
          <button type="button" onClick={() => setAssetsOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
            <span className="flex items-center gap-2 text-[13px] font-extrabold" style={{ color: BROWN, fontFamily: "var(--ff-display)" }}>{assetsOpen ? "📂" : "📁"} Photos from Moments <span className="rounded-full bg-[#f6e2a8] px-2 py-0.5 text-[11px] font-extrabold text-[#8a5a00]">{savedImages.length}</span>{assetsOpen && <span className="text-[11px] font-semibold text-[var(--ink-3)]">— type your message, add the quote, set size/crop/colour.</span>}</span>
            <span className="flex-none rounded-full border border-[#f0d488] px-2.5 py-0.5 text-[11.5px] font-bold text-[#8a5a00]">{assetsOpen ? "▲ Close folder" : "▼ Open folder"}</span>
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
      {sigMgr && <SignatureManager settings={settings} save={save} onClose={() => setSigMgr(false)} />}
    </OperatorPage>
  );
}
