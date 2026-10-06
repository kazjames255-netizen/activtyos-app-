"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { api, get as apiGet, post as apiPost, isDemoMode } from "@/lib/api";
import { useHoScope, getHoScopeId, HO_OWN } from "@/components/franchise/HoScope";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { useT, tNow, useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { currentLocaleCode } from "@/lib/i18n/format";
import { RichB } from "@/features/common/richB";
import { type Season } from "@/lib/seasons";
import type { SavedImage } from "@/lib/settings";
import { composeMomentImage, resolveSavedText, triggerDownload } from "@/lib/momentImage";
import { Badge, Card, FieldLabel, Input, Select } from "@/components/ui";
import { OperatorPage, TabStrip } from "@/components/OperatorPage";
import { useSurfaceTheme } from "@/lib/surfaceThemes";
import { MERGE_FIELDS } from "@/lib/merge-fields";
import type { TenantSettings } from "@/lib/settings";
import { downscaleImage, type Company, type Newsletter } from "@/features/newsfeed/newsletter";
import { CampaignDesigner, renderDesignHtml, renderDesignText, loadMyTemplates, persistMyTemplates, type CampaignDesign, type Block, type SavedTemplate, type Social } from "@/features/email/campaignTemplates";
import { GmailSetupWalkthrough } from "@/features/email/GmailSetupWalkthrough";
import { DEMO_INBOX, bestBody, htmlToText, type ServerMail } from "@/features/email/inbox-data";

// ── "Automatic emails" — which system emails Name TBC sends on the provider's
// behalf, mirroring the Build Manual's Email screen. Toggles + reminder timing
// persist to settings.autoEmails; the actual sending is a backend job (see
// docs/email-notifications-handoff.md).
type AutoKey = keyof NonNullable<TenantSettings["autoEmails"]>;
const REMINDER_TIMES: [number, string][] = [[12, "12 hours before"], [24, "24 hours before"], [48, "48 hours before"], [72, "3 days before"]];
const AUTO_EMAILS: { key: AutoKey; title: string; sub: string; desc: string; core?: boolean; timing?: AutoKey }[] = [
  { key: "bookings", title: "Bookings & approvals", sub: "Booking confirmed, request approved/declined & cancellation emails", core: true, desc: "Automatic emails to the parent for: booking confirmed, request-to-book approved, request declined, and cancellation confirmed. Core transactional emails — best left on." },
  { key: "payments", title: "Payments", sub: "Receipts, refunds & payment-failed emails", desc: "Sends a receipt when a payment succeeds, a note when a refund is issued, and an alert if a card payment fails." },
  { key: "sessionReminder", title: "Session reminders", sub: "A pre-session reminder with the key details & what to bring", timing: "sessionTiming", desc: "Sent before the session. Includes the child’s name, date, start & finish times, venue and what to bring. Any outstanding balance is shown; once it’s paid the price isn’t re-quoted." },
  { key: "waitlistFreeAlert", title: "Alert me when a place frees up", sub: "", desc: "" },
  { key: "waitlist", title: "Waitlist", sub: "Tells a waitlisted parent when a place opens or they move up", desc: "When a place frees up, the next waitlisted parent is emailed an offer with a time limit to claim it. They can also be told when they move up the queue." },
  { key: "dayOf", title: "Day-of alerts", sub: "On-the-day arrival alerts (incl. logged incidents)", desc: "On-the-day operational alerts: a child not yet signed in 30 minutes after a session starts, and a notification when an incident is logged (the incident detail stays restricted to Head Office and the staff who logged it)." },
  { key: "lateCollection", title: "Late collection", sub: "Alerts you when children aren’t collected on time", desc: "30 minutes after a session ends (or your Registers-tab threshold), if any children are still signed in you’re alerted that some haven’t been collected. The alert doesn’t name them — open the register to see who." },
  { key: "announcements", title: "New camp announcements", sub: "Email your past & opted-in customers when new camps open", desc: "A one-off email to your OWN past and opted-in customers announcing new camps or dates. This is re-marketing to people who have already booked with you — Name TBC has no public marketplace or ‘followers’." },
  { key: "reviewRequests", title: "Review requests", sub: "Asks a parent to leave a review after their final session", desc: "Sent once, after the parent’s LAST booked session (not after every booking). The link takes them straight to the review screen." },
];

// Head-office network scope → a ?franchiseId= query the email API reads. A set
// scope (a franchise, or HO_OWN = own locations) narrows every read + send; the
// "all franchises" scope is null → no param → the whole network (Model A).
function withNet(url: string): string {
  const s = getHoScopeId();
  if (!s) return url;
  return `${url}${url.includes("?") ? "&" : "?"}franchiseId=${encodeURIComponent(s)}`;
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className="relative h-6 w-11 flex-none rounded-full transition-colors" style={{ background: on ? "#22a565" : "#cfd3dd" }}>
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-[var(--surface)] shadow transition-all" style={{ insetInlineStart: on ? 22 : 2 }} />
    </button>
  );
}

function AutoEmails({ settings, save }: { settings: TenantSettings; save: (patch: { settings?: TenantSettings }) => Promise<void> }) {
  const t = useT();
  const ae = settings.autoEmails ?? {};
  const set = (patch: Partial<NonNullable<TenantSettings["autoEmails"]>>) => save({ settings: { ...settings, autoEmails: { ...ae, ...patch } } });
  return (
    <div>
      <p className="mb-3 max-w-[720px] text-[12.5px] leading-[1.5] text-[var(--ink-3)]">{t("p8em.emAutoIntro")}</p>
      <div className="flex flex-col gap-2.5">
        {AUTO_EMAILS.map((c) => {
          // Effective on-state: everything defaults ON except announcements (opt-in re-marketing).
          const value = (ae[c.key] as boolean | undefined) ?? (c.key === "announcements" ? false : true);
          return (
            <div key={c.key} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_1px_3px_rgba(20,30,60,.06)]">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-extrabold text-[var(--ink)]">{t("p8em.emAuto_" + c.key + "_title")}</span>
                    {c.core && <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-extrabold text-[#1d3a8f]">{t("p8em.emCore")}</span>}
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-semibold text-[var(--ink-2)]">{t("p8em.emAuto_" + c.key + "_sub")}</div>
                  <div className="mt-1 text-[12px] leading-[1.5] text-[var(--ink-3)]">{t("p8em.emAuto_" + c.key + "_desc")}</div>
                  {c.timing && value && (
                    <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-2)]">
                      {t("p8em.cSend")}
                      <Select value={String(ae[c.timing] ?? (c.timing === "sessionTiming" ? 48 : 24))} onChange={(e) => set({ [c.timing as string]: Number(e.target.value) })}>
                        {REMINDER_TIMES.map(([v]) => <option key={v} value={v}>{t("p8em.emRem_" + v)}</option>)}
                      </Select>
                    </label>
                  )}
                </div>
                <Toggle on={value} onClick={() => { if (c.key === "waitlistFreeAlert" && value && !window.confirm(t("p8em.emWaitAlertOffWarn"))) return; set({ [c.key]: !value }); }} label={t("p8em.emAuto_" + c.key + "_title")} />
              </div>
              {c.key === "payments" && value && (
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-[var(--ink)]">{t("p8em.emPayDue")}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8em.emPayDueSub")}</div>
                    {ae.paymentDue !== false && (
                      <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-2)]">{t("p8em.cSend")}
                        <Select value={String(ae.paymentDueTiming ?? 24)} onChange={(e) => set({ paymentDueTiming: Number(e.target.value) })}>
                          {REMINDER_TIMES.map(([v]) => <option key={v} value={v}>{t("p8em.emRem_" + v)}</option>)}
                        </Select>
                      </label>
                    )}
                  </div>
                  <Toggle on={ae.paymentDue !== false} onClick={() => set({ paymentDue: ae.paymentDue === false })} label={t("p8em.emPayDue")} />
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
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${tNow("p8em.emDocumentTitle")}</title><style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:10mm}html,body{margin:0}body{font-family:system-ui,-apple-system,sans-serif;padding:12px}</style></head><body>${html}<script>window.onload=function(){window.focus();window.print();}</script></body></html>`);
  w.document.close();
}

// Turn the composer's light markdown (# heading, **bold**, _italic_, [text](url),
// line breaks) into safe HTML so the formatting actually renders in the sent email.
function mdToHtml(src: string): string {
  // Quotes too: a quote in link text or a URL must not break out of href="…".
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return esc(src)
    .replace(/^# (.*)$/gm, '<h3 style="margin:0 0 8px">$1</h3>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/_([^_]+)_/g, "<i>$1</i>")
    // Web, email and in-app links only — never javascript: or data:.
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^)\s]*)\)/gi, '<a href="$2">$1</a>')
    .replace(/\n/g, "<br>");
}
// htmlToText / bestBody / ServerMail / DEMO_INBOX now live in ./inbox-data, so
// the dashboard's Inbox card shares them (same previews, same counts).

// A small WYSIWYG editor — Bold/Heading/Italic/List/Link format the text LIVE
// (contentEditable), and the value is HTML that's emailed as-is.
function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const selImg = useRef<HTMLImageElement | null>(null);
  const [imgW, setImgW] = useState(100);          // width % of the targeted image
  const hasImg = /<img/i.test(value);
  // The image the size bar controls: the last-clicked one, else the last in the body.
  const targetImg = (): HTMLImageElement | null => { const el = ref.current; if (!el) return null; if (selImg.current && el.contains(selImg.current)) return selImg.current; const imgs = el.querySelectorAll("img"); return imgs.length ? (imgs[imgs.length - 1] as HTMLImageElement) : null; };
  useEffect(() => { const el = ref.current; if (el && el.innerHTML !== value) { el.innerHTML = value; selImg.current = null; } }, [value]);
  const cmd = (c: string, arg?: string) => { ref.current?.focus(); document.execCommand(c, false, arg); if (ref.current) onChange(ref.current.innerHTML); };
  const pickImg = (e: React.MouseEvent) => { const tg = e.target as HTMLElement; if (tg.tagName === "IMG") { const img = tg as HTMLImageElement; selImg.current = img; setImgW(parseInt(img.style.width) || 100); } };
  const sizeImg = (w: number) => { const img = targetImg(); if (!img) return; selImg.current = img; const cw = Math.min(100, Math.max(10, Math.round(w))); img.style.width = `${cw}%`; img.style.height = "auto"; setImgW(cw); if (ref.current) onChange(ref.current.innerHTML); };
  const btn = "rounded px-2 py-1 text-[13px] text-[var(--ink-2)] hover:bg-[var(--surface)]";
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
          if (c === "color") return <label key={i} onMouseDown={(e) => e.preventDefault()} title={t("p8em.emTextColour")} className={`${btn} relative cursor-pointer font-extrabold`} style={{ color: "#2f6bd8" }}>A<input type="color" onChange={(e) => cmd("foreColor", e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label>;
          if (c === "link") return <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { const u = prompt(t("p8em.emLinkUrl")); if (u) cmd("createLink", u); }} title={t("p8em.emTool_" + (arg ?? c))} className={btn}>{label}</button>;
          return <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd(c, arg)} title={t("p8em.emTool_" + (arg ?? c))} className={`${btn} ${cls}`}>{label}</button>;
        })}
      </div>
      {hasImg && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#dbe6fb] bg-[#f4f8ff] px-3 py-2">
          <span className="flex-none text-[11.5px] font-extrabold text-[#1d3a8f]">{t("p8em.emPhotoSize")}</span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeImg(imgW - 5)} className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[#E4E9F5] bg-[var(--surface)] text-[15px] font-extrabold text-[#2f5fd0] hover:bg-[#E8EEFD]">−</button>
          <input type="range" min={10} max={100} step={1} value={imgW} onChange={(e) => sizeImg(Number(e.target.value))} className="h-1.5 min-w-[120px] flex-1 accent-[#2f6bd8]" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeImg(imgW + 5)} className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[#E4E9F5] bg-[var(--surface)] text-[15px] font-extrabold text-[#2f5fd0] hover:bg-[#E8EEFD]">+</button>
          <span className="w-10 flex-none text-end text-[12px] font-extrabold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{imgW}%</span>
          <div className="mx-1 h-4 w-px flex-none bg-[#dbe6fb]" />
          {([["S", 30], ["M", 60], ["L", 100]] as const).map(([l, w]) => <button key={l} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeImg(w)} className="flex-none rounded-md border border-[#E4E9F5] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-bold text-[#2f5fd0] hover:bg-[#E8EEFD]">{l}</button>)}
        </div>
      )}
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        onClick={pickImg}
        className="min-h-[180px] px-3 py-2.5 text-[13px] leading-relaxed outline-none [&_a]:text-[#1d3a8f] [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-[var(--line)] [&_blockquote]:ps-3 [&_blockquote]:text-[var(--ink-3)] [&_h3]:mb-1 [&_h3]:text-[16px] [&_h3]:font-extrabold [&_img]:cursor-pointer [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5" />
      {hasImg && <div className="rounded-b-lg border-t border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-[10.5px] text-[var(--ink-3)]">{t("p8em.emPhotoSizeTip")}</div>}
    </div>
  );
}
interface Sent { id: string; subject: string; audience: string; recipientCount: number; sentByName?: string; createdAt?: string; status?: "sending" | "sent"; delivered?: number; openedBy?: string[] }
interface LiveMoment { id: string; caption?: string; comments?: { role?: string; text: string; byName?: string; marketing?: boolean }[] }
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(dl(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const BROWN = "#9a5a00", BLUE = "#1d3a8f", GREEN = "#047857";
const SWATCHES = ["#171534", "#1d3a8f", "#be1259", "#047857", "#b45309"];
const RATIO_AR: Record<string, string> = { square: "1 / 1", portrait: "4 / 5", story: "9 / 16" };

// One saved Moments photo. Its own message (the caption sent to parents) and its
// own marketing quote sit UNDER the image — so there's never a question of which
// quote belongs to which photo. Message/Quote are toggled right on the card; the
// rest (size, crop, colour) live behind Edit. "Add to email" uses what's ticked.
function SavedImageCard({ im, onPatch, onRemove, onAdd }: { im: SavedImage; onPatch: (p: Partial<SavedImage>) => void; onRemove: () => void; onAdd: () => void }) {
  const t = useT();
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
        {preview ? <img src={preview} alt={im.childName ?? t("p8em.emMomentAlt")} className="h-full w-full object-contain" /> : <img src={im.photoUrl} alt="" className="h-full w-full object-cover opacity-60" />}
      </div>
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11.5px] font-bold">{im.childName ?? t("p8em.emMoment")}</span>
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold" style={editing ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{editing ? t("p8em.emDone") : t("p8em.emSizeCropColour")}</button>
        </div>

        {/* message you type + the moment's quote — shown under the photo (live preview above) */}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8em.emMsgUnderPhoto")}</span>
          {momentCaption && captionValue !== momentCaption && <button type="button" onClick={() => onPatch({ customCaption: momentCaption })} className="text-[10px] font-bold text-[#1d3a8f]">{t("p8em.emParentMsgReset")}</button>}
        </div>
        <textarea value={captionValue} onChange={(e) => onPatch({ customCaption: e.target.value })} rows={2} placeholder={t("p8em.emCaptionPh")} className="mt-1 w-full resize-none rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11.5px] [field-sizing:content]" />
        <button type="button" disabled={nQuotes === 0} onClick={() => onPatch({ include: { ...inc, quote: !inc.quote } })} className="mt-1.5 rounded-full border-2 px-2.5 py-0.5 text-[11px] font-bold disabled:opacity-45" style={incBtn(inc.quote, nQuotes > 0)}>{inc.quote && nQuotes > 0 ? "✓ " : ""}{t("p8em.emShowQuote")}{nQuotes ? ` (${nQuotes})` : ` ${t("p8em.emNone")}`}</button>

        {editing && (
          <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2 text-[10.5px]">
            <div className="mb-1 font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8em.emSize")}</div>
            <div className="mb-2 flex flex-wrap gap-1">{([["square", "1:1"], ["portrait", "4:5"], ["story", "9:16"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => onPatch({ ratio: k })} className="rounded-full border px-2 py-0.5 font-bold" style={chip(im.ratio === k)}>{l}</button>)}</div>
            <div className="mb-1 font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8em.emCrop")}</div>
            <div className="mb-2 flex flex-wrap gap-1">{([["contain", t("p8em.emWholePhoto")], ["cover", t("p8em.emFillCrop")]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => onPatch({ fit: k })} className="rounded-full border px-2 py-0.5 font-bold" style={chip(fit === k)}>{l}</button>)}</div>
            <div className="mb-1 font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8em.emTextColour")}</div>
            <div className="mb-2 flex flex-wrap items-center gap-1">{SWATCHES.map((sw) => <button key={sw} type="button" onClick={() => onPatch({ color: sw })} className="h-5 w-5 rounded-full border-2" style={{ background: sw, borderColor: im.color === sw ? "#171534" : "var(--line)" }} title={sw} />)}<input type="color" value={im.color} onChange={(e) => onPatch({ color: e.target.value })} className="h-6 w-7 cursor-pointer rounded border border-[var(--line)]" title={t("p8em.emCustomColour")} /></div>
            {nParent > 0 && <button type="button" onClick={() => onPatch({ include: { ...inc, comments: !inc.comments } })} className="rounded-full border-2 px-2.5 py-0.5 text-[11px] font-bold" style={incBtn(inc.comments, true)}>{inc.comments ? "✓ " : ""}{t("p8em.emAllComments", { n: nParent })}</button>}
          </div>
        )}

        <div className="mt-2 flex gap-1.5">
          <button type="button" onClick={onAdd} className="flex-1 rounded-md px-2 py-1 text-[11px] font-extrabold text-white" style={{ background: "#7a4e2a" }}>{t("p8em.emAddToEmail")}</button>
          <button type="button" onClick={() => triggerDownload(preview ?? im.photoUrl, `${(im.childName ?? "moment").replace(/\s+/g, "-")}-${im.ratio}.jpg`)} className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] font-bold" title={t("p8em.emDownloadImgTip")}>⬇</button>
          <button type="button" onClick={onRemove} className="rounded-md border border-[#f6c9cc] px-2 py-1 text-[11px] font-bold text-[#c02636] hover:bg-[#fdebec]" title={t("p8em.emDeletePhotoTip")}>🗑</button>
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

// A queued send (POST /api/emails/schedule) waiting for its sendAt.
interface Scheduled { id: string; subject: string; body?: string; recipientCount: number; sendAt: string; status: "scheduled" | "sent" | "cancelled"; emailId?: string }
// GET /api/emails/sender — the name families see and where their replies land.
// The address is the platform's for every provider (one authenticated sending
// domain); per-provider sending domains are the white-label milestone.
interface SenderIdentity { fromName: string; fromAddress: string; replyTo: string | null }

const KNOWN_LABELS = new Set<string>(["urgent", "follow", "haf", "enquiry", "system"]);

const toMail = (m: ServerMail): Mail => ({
  id: m.id,
  from: m.from,
  fromEmail: m.fromEmail,
  to: m.to,
  subject: m.subject,
  preview: bestBody(m).replace(/\s+/g, " ").slice(0, 120),
  body: bestBody(m),
  time: when(m.at),
  unread: m.unread,
  starred: m.starred,
  labels: (m.labels ?? []).filter((l): l is LabelTone => KNOWN_LABELS.has(l)),
  attachment: m.attachments?.[0]?.name,
  attachmentSize: m.attachments?.[0]?.size,
  folder: (["inbox", "archive", "snoozed", "spam", "trash"].includes(m.folder ?? "") ? m.folder : "inbox") as MailFolder,
});
// "Sends Fri 1 Aug, 09:00" — sendAt is a local datetime string, not ISO+tz.
const whenSched = (sendAt: string) => new Date(sendAt).toLocaleString(dl(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const FOLDERS: [string, string][] = [
  ["inbox", "Inbox"], ["starred", "Starred"], ["snoozed", "Snoozed"], ["sent", "Sent"],
  ["drafts", "Drafts"], ["scheduled", "Scheduled"], ["archive", "Archive"], ["spam", "Spam"], ["trash", "Trash"], ["all", "All mail"],
];

interface Mailbox { configured: boolean; address: string | null; received: number; lastAt: string | null; pendingVerification: { code?: string; link?: string; at?: string } | null }

/** "Connect your mailbox" — one redirect rule in Outlook/Gmail and a
 *  provider's parent mail lands in this Inbox. Renders nothing until the
 *  platform has an inbound domain: an unconfigured address would just swallow
 *  their mail, and it isn't something a provider can fix. */
// Where each provider's forwarding setting actually lives. Deep links save a
// provider hunting through menus — the single biggest reason setup is
// abandoned. Outlook splits personal vs work/school on different hosts.
const MAIL_HOSTS = [
  {
    id: "outlook", label: "Outlook", emoji: "📨",
    links: [
      ["Open Outlook.com settings", "https://outlook.live.com/mail/0/options/mail/forwarding"],
      ["Open work/school Outlook settings", "https://outlook.office.com/mail/options/mail/forwarding"],
    ] as [string, string][],
    steps: [
      "Tick “Enable forwarding”.",
      "Paste your Name TBC address into the box.",
      "Tick “Keep a copy of forwarded messages” so nothing leaves your own inbox.",
      "Press Save.",
    ],
    note: "Prefer Rules → “Redirect to” if you see it: a redirect keeps the parent as the sender, so replies go straight back to them.",
  },
  {
    id: "gmail", label: "Gmail", emoji: "✉️",
    links: [["Open Gmail forwarding settings", "https://mail.google.com/mail/u/0/#settings/fwdandpop"]] as [string, string][],
    steps: [
      "Click “Add a forwarding address” and paste your Name TBC address.",
      "Google emails a confirmation code to us — it appears on this page within a minute.",
      "Type that code back into Gmail and press Verify.",
      "Choose “Forward a copy… and keep Gmail’s copy in the Inbox”, then Save Changes.",
    ],
    note: "Gmail won’t start forwarding until the code is entered — that’s the step people get stuck on, so we show it to you here.",
  },
  {
    id: "other", label: "Something else", emoji: "🌐",
    links: [] as [string, string][],
    steps: [
      "Sign in to your email provider’s website (not the app).",
      "Look for Settings → Forwarding, or “Forwarders” if your website host runs your email.",
      "Paste your Name TBC address and save.",
      "Keep a copy in your own inbox if it offers the choice.",
    ],
    note: "Yahoo only allows forwarding on its paid plan. If you’re stuck, send us the name of your email provider and we’ll write the steps for you.",
  },
];

interface Mailbox { configured: boolean; address: string | null; received: number; lastAt: string | null; pendingVerification: { code?: string; link?: string; at?: string } | null }

/** "See your emails here" — a provider adds one forwarding rule and the mail
 *  parents send them appears in this Inbox. Written for someone who has never
 *  heard of mail forwarding: pick your email, follow four steps, and the panel
 *  confirms by itself the moment the first message lands. Renders nothing
 *  until the platform has an inbound domain. */
function MailboxSetup({ context = "inbox" }: { context?: "inbox" | "settings" }) {
  const t = useT();
  const [mb, setMb] = useState<Mailbox | null>(null);
  const [copied, setCopied] = useState(false);
  const [host, setHost] = useState<string | null>(null);
  const [walk, setWalk] = useState(false); // the Gmail step-by-step walkthrough overlay
  const [open, setOpen] = useState(false); // the "Setting up your email" dropdown — collapsed by default
  const { settings, save } = useSettings();
  const load = useCallback(() => { apiGet<Mailbox>("/api/emails/mailbox").then(setMb).catch(() => {}); }, []);
  useEffect(load, [load]);
  useRealtime(["emailMessages"], load);
  // Auto-open when Gmail's confirmation code lands, or when the provider is
  // mid-setup for a host — those are the moments the steps must be on screen.
  useEffect(() => { if (mb?.pendingVerification || host) setOpen(true); }, [mb?.pendingVerification, host]);

  // Dismissed from the Inbox, but never from Settings — that's where someone
  // goes to look for it again, so hiding it there would strand them.
  const dismissed = !!settings.emailPrefs?.mailboxSetupDismissed;
  const setDismissed = (v: boolean) =>
    save({ settings: { ...settings, emailPrefs: { ...(settings.emailPrefs ?? {}), mailboxSetupDismissed: v } } });
  if (context === "inbox" && dismissed) return null;

  // Not switched on for this platform yet. The Inbox stays silent — it isn't
  // something a provider can act on. Settings is where someone goes to ASK,
  // so it owes them an answer rather than an empty tab.
  if (!mb?.configured || !mb.address) {
    if (context !== "settings" || !mb) return null;
    return (
      <Card className="p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8em.emMbShowOwn")}</div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-3)]">
          {t("p8em.emMbOff")}
        </p>
      </Card>
    );
  }
  const address = mb.address;
  const live = mb.received > 0;
  const copy = () => { navigator.clipboard?.writeText(address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); };
  const chosen = MAIL_HOSTS.find((h) => h.id === host);

  // Once mail is flowing this collapses to a single reassuring line — the
  // setup instructions have done their job and shouldn't keep taking space.
  // A pending Gmail code always wins: it's time-sensitive, it only exists
  // here, and someone connecting a SECOND mailbox already has mail arriving.
  if (live && !host && !mb.pendingVerification) {
    // Set up — the dropdown has done its job. It vanishes from the Inbox
    // entirely; Settings keeps a compact confirmation + a way back in.
    if (context === "inbox") return null;
    return (
      <div data-ui="mailbox-setup" className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#cdeacd] bg-[#f3fbf3] px-4 py-2.5">
        <span className="text-[13px] font-extrabold text-[#127a3e]">{t("p8em.emMbConnected")}</span>
        <code data-ui="inbound-address" className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--ink-2)]">{address}</code>
        <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8em.emMbLastMsg", { when: when(mb.lastAt ?? undefined) })}</span>
        <button type="button" onClick={() => setWalk(true)} className="text-[11.5px] font-bold text-[#1d3a8f] underline">{t("p8em.emMbGmailWalk")}</button>
        <button type="button" onClick={() => setHost("outlook")} className="ms-auto text-[11.5px] font-bold text-[#1d3a8f] underline">{t("p8em.emMbChange")}</button>
        {walk && <GmailSetupWalkthrough address={address} onClose={() => setWalk(false)} />}
      </div>
    );
  }

  return (
    <div data-ui="mailbox-setup" className="overflow-hidden rounded-2xl border border-[#E4E9F5] bg-[var(--surface)]">
      {/* The dropdown header — always visible; a click reveals the steps. */}
      <div className="flex items-center gap-2 bg-[#f4f8ff] px-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
          <span className="text-[16px]">📧</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-extrabold text-[#16306e]">{t("p8em.emMbSetupTitle")}</span>
            <span className="block text-[11.5px] leading-snug text-[var(--ink-3)]">{t("p8em.emMbSetupSub")} {live ? <b className="text-[#127a3e]">{t("p8em.emMbAlmost")}</b> : t("p8em.emMbTap")}</span>
          </span>
          <span className="flex-none text-[12px] font-bold text-[var(--ink-3)]">{open ? t("p8em.emMbHide") : t("p8em.emMbShow")}</span>
        </button>
        {context === "inbox" && (
          <button type="button" onClick={() => setDismissed(true)} title={t("p8em.emMbHideTip")}
            className="flex-none rounded-lg px-1.5 py-0.5 text-[15px] font-bold leading-none text-[var(--ink-3)] hover:bg-[var(--surface)] hover:text-[var(--ink)]">×</button>
        )}
      </div>

      {!open ? null : <div className="border-t border-[#dbe6fb] px-4 py-3">
        <div className="mb-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          <RichB text={t("p8em.emMbIntro")} />
        </div>
        {/* Gmail is by far the most common host, and its confirmation-code step
            is where people get stuck — so we offer a screen-by-screen walk. */}
        <button type="button" onClick={() => setWalk(true)}
          className="mb-3 inline-flex items-center gap-2 rounded-xl border border-[#dbe6fb] bg-[#f4f8ff] px-3.5 py-2 text-[12.5px] font-extrabold text-[#16306e] hover:border-[#2f6bd8]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-b from-[#4f8bf5] to-[#2f6bd8] text-[10px] text-white">▶</span>
          {t("p8em.emMbWatch")}
          <span className="font-semibold text-[var(--ink-3)]">{t("p8em.emMb8Screens")}</span>
        </button>
        {/* Step 1 — the address. Always visible: it's what every route needs. */}
        <div className="text-[12.5px] font-extrabold text-[var(--ink)]">{t("p8em.emMbStep1")}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <code data-ui="inbound-address" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-bold text-[var(--ink)]">{address}</code>
          <button type="button" onClick={copy} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold text-white" style={{ background: copied ? "#0f9d58" : "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{copied ? t("p8em.emCopied") : t("p8em.emCopy")}</button>
          <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8em.emMbOwnAddr")}</span>
        </div>

        {/* Step 2 — pick a provider, then show only that provider's steps. */}
        <div className="mt-4 text-[12.5px] font-extrabold text-[var(--ink)]">{t("p8em.emMbStep2")}</div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {MAIL_HOSTS.map((h) => (
            <button key={h.id} type="button" onClick={() => setHost(h.id)}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold"
              style={host === h.id ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
              {h.emoji} {h.id === "other" ? t("p8em.emHost_other_label") : h.label}
            </button>
          ))}
        </div>

        {chosen && (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
            {chosen.links.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-2">
                {chosen.links.map(([, href], li) => (
                  <a key={href} href={href} target="_blank" rel="noreferrer" className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12.5px] font-extrabold text-white">{t(`p8em.emHost_${chosen.id}_link${li}`)} ↗</a>
                ))}
              </div>
            )}
            <ol className="ms-4 list-decimal text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              {chosen.steps.map((s, si) => <li key={s} className="mt-0.5">{t(`p8em.emHost_${chosen.id}_s${si}`)}</li>)}
            </ol>
            <div className="mt-2 text-[11.5px] leading-relaxed text-[var(--ink-3)]">{t(`p8em.emHost_${chosen.id}_note`)}</div>
          </div>
        )}

        {/* Gmail's code — delivered to US, so the provider can only get it here. */}
        {mb.pendingVerification && (
          <div className="mt-3 rounded-xl border border-[#f3d98a] bg-[#fdf6e3] p-3.5">
            <div className="text-[12.5px] font-extrabold text-[#7a5a12]">{t("p8em.emMbGmailCode")}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              {mb.pendingVerification.code && <code data-ui="gmail-code" className="rounded-lg bg-[var(--surface)] px-3 py-1.5 text-[17px] font-extrabold tracking-[0.15em] text-[var(--ink-2)]">{mb.pendingVerification.code}</code>}
              <span className="text-[12px] text-[#7a5a12]"><RichB text={t("p8em.emMbTypeVerify")} /></span>
            </div>
            {mb.pendingVerification.link && <a href={mb.pendingVerification.link} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[11.5px] font-bold text-[#1d3a8f] underline">{t("p8em.emMbOrLink")}</a>}
          </div>
        )}

        {/* Step 3 — proves itself. No "test" button to misinterpret: the panel
            simply turns green when a real message arrives. */}
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] px-3.5 py-2.5">
          <span className="text-[12.5px] font-extrabold text-[var(--ink)]">{t("p8em.emMbStep3")}</span>
          {live
            ? <span data-ui="mailbox-live" className="text-[12.5px] font-extrabold text-[#127a3e]">{t("p8em.emMbWorking")}</span>
            : <span className="text-[12.5px] text-[var(--ink-2)]">{t("p8em.emMbWaiting")}</span>}
        </div>

        <div className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
          <RichB text={t("p8em.emMbGood")} />
        </div>

        {/* Settings is the panel's permanent home, so it owns the on/off switch
            for showing it in the Inbox. */}
        {context === "settings" && (
          <div className="mt-2.5 text-[11.5px] text-[var(--ink-3)]">
            {dismissed ? (
              <>{t("p8em.emMbHidden")} <button type="button" onClick={() => setDismissed(false)} className="font-bold text-[#1d3a8f] underline">{t("p8em.emMbShowAgain")}</button></>
            ) : (
              <button type="button" onClick={() => setDismissed(true)} className="font-bold text-[#1d3a8f] underline">{t("p8em.emMbHideFromInbox")}</button>
            )}
          </div>
        )}
      </div>}
      {walk && <GmailSetupWalkthrough address={address} code={mb.pendingVerification?.code} onClose={() => setWalk(false)} />}
    </div>
  );
}


// Received mail is stored as PLAIN TEXT, and was being dropped into a <p> —
// which collapses every newline and leaves URLs as dead text you have to copy
// out by hand. Render it with the line breaks intact and the links live.
//
// Deliberately NOT dangerouslySetInnerHTML over the sender's own HTML: inbound
// mail is attacker-controlled, so that would be an XSS hole. Building React
// nodes from matched text can't inject markup.
const LINKIFY_RE = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)]|[\w.+-]+@[\w-]+\.[\w.-]*[\w])/g;

function linkify(text: string) {
  return text.split(LINKIFY_RE).map((part, i) => {
    if (i % 2 === 0 || !part) return part;                    // odd indices are the matches
    const isEmail = part.includes("@") && !part.includes("//");
    const href = isEmail ? `mailto:${part}` : part.startsWith("http") ? part : `https://${part}`;
    return (
      <a key={`${i}-${part}`} href={href} target={isEmail ? undefined : "_blank"} rel="noreferrer noopener"
        className="font-semibold text-[#1d3a8f] underline underline-offset-2 hover:text-[#16306e]">{part}</a>
    );
  });
}

function InboxView({ onCompose, onReply, onForward, onQuickReply, onEnquiry, history, locations, messages, scheduled, onRefresh, seedMail }: { onCompose: () => void; onReply: (m: Mail) => void; onForward: (m: Mail) => void; onQuickReply: (m: Mail, text: string) => void; onEnquiry: (m: Mail, locations: string[]) => void; history: Sent[] | null; locations: string[]; messages: ServerMail[] | null; scheduled: Scheduled[] | null; onRefresh: () => void; seedMail?: string | null }) {
  const { t, locale } = useI18n();
  const [enqFor, setEnqFor] = useState<Mail | null>(null);
  const [enqLocs, setEnqLocs] = useState<string[]>([]);
  // Server messages, patched optimistically — the realtime refresh reconciles.
  const [items, setItems] = useState<Mail[]>([]);
  const [folder, setFolder] = useState("inbox");
  const [filter, setFilter] = useState<"all" | "unread" | "starred" | "files">("all");
  const [density, setDensity] = useState<"cozy" | "compact">("cozy");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Mail | null>(null);
  const [showContact, setShowContact] = useState(false);

  // Arrived from the dashboard's Inbox card (?mail=<id>)? Open that message as
  // soon as the mail it names has loaded — marking it read the same way a click
  // in the list would. Once only, so closing it doesn't reopen on the next
  // realtime refresh.
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    const next = (messages ?? []).map(toMail);
    const target = seedMail && seeded.current !== seedMail ? next.find((m) => m.id === seedMail) : undefined;
    if (target) {
      seeded.current = seedMail ?? null;
      if (target.unread) {
        target.unread = false;
        void api(`/api/emails/messages/${target.id}`, { method: "PATCH", body: JSON.stringify({ unread: false }) }).catch(() => onRefresh());
      }
      setOpen(target);
    }
    setItems(next);
    // onRefresh is a stable useCallback on the parent; re-running on it would
    // just re-seed the same message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, seedMail]);

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
  const cancelScheduled = (m: Mail) => { if (!m.schedId || !confirm(t("p8em.emCancelSchedConfirm", { subject: m.subject }))) return; void api(`/api/emails/scheduled/${m.schedId}`, { method: "DELETE" }).then(() => onRefresh()).catch(() => onRefresh()); setOpen(null); };
  const reply = (m: Mail) => { setOpen(null); onReply(m); };
  const forward = (m: Mail) => { setOpen(null); onForward(m); };
  const markUnread = (m: Mail) => { patch(m.id, { unread: true }); persist(m.id, { unread: true }); setOpen(null); };
  const quickReply = (m: Mail, text: string) => { setOpen(null); onQuickReply(m, text); };

  // Real sent history shows in the Sent folder as mail rows.
  const sentMail: Mail[] = (history ?? []).map((h) => ({ id: `sent-${h.id}`, from: t("p8em.emYou"), subject: h.subject, preview: h.audience === "one" ? t("p8em.emSentTo1") : t("p8em.emSentToN", { n: h.recipientCount }), time: when(h.createdAt), folder: "sent" }));
  // The server-side scheduled queue shows in Scheduled, cancellable until it fires.
  const schedMail: Mail[] = (scheduled ?? []).filter((s) => s.status === "scheduled").map((s) => ({ id: `sch-${s.id}`, schedId: s.id, from: t("p8em.emYou"), subject: s.subject, preview: t("p8em.emSendsPreview", { when: whenSched(s.sendAt), n: s.recipientCount }), body: s.body, time: whenSched(s.sendAt), folder: "scheduled" }));
  const pool = folder === "sent" ? sentMail : folder === "scheduled" ? schedMail : items;
  const inFolder = (m: Mail) => {
    if (folder === "all") return m.folder !== "spam" && m.folder !== "trash";
    if (folder === "starred") return !!m.starred && m.folder !== "spam" && m.folder !== "trash";
    if (folder === "inbox") return (m.folder ?? "inbox") === "inbox";
    return m.folder === folder;
  };
  const restorable = folder === "archive" || folder === "snoozed" || folder === "spam" || folder === "trash";
  // A tenant's forwarded inbox accumulates over years — memoize the folder/filter/
  // search pass instead of re-scanning `pool` on every render, including every
  // keystroke in the search box.
  const list = useMemo(() => pool.filter(inFolder)
    .filter((m) => filter === "all" || (filter === "unread" && m.unread) || (filter === "starred" && m.starred) || (filter === "files" && m.attachment))
    .filter((m) => { const s = q.trim().toLowerCase(); return !s || `${m.from} ${m.subject} ${m.preview}`.toLowerCase().includes(s); }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [pool, folder, filter, q]);
  // Folder-sidebar badge counts used to be `items.filter(...).length` called once
  // per folder button (a full rescan of the inbox per folder, on every render) —
  // same "one pass per option" bug as LeadsApp's dropdown counts. One pass here.
  const folderCounts = useMemo(() => {
    let inboxUnread = 0, starred = 0;
    const byFolder = new Map<string, number>();
    for (const m of items) {
      if ((m.folder ?? "inbox") === "inbox" && m.unread) inboxUnread++;
      if (m.starred && m.folder !== "spam" && m.folder !== "trash") starred++;
      const f = m.folder ?? "inbox";
      byFolder.set(f, (byFolder.get(f) ?? 0) + 1);
    }
    return { inboxUnread, starred, byFolder };
  }, [items]);
  const count = (k: string) => k === "sent" ? sentMail.length : k === "scheduled" ? schedMail.length || undefined : k === "inbox" ? folderCounts.inboxUnread
    : k === "starred" ? folderCounts.starred
    : (k === "archive" || k === "snoozed" || k === "spam" || k === "trash") ? folderCounts.byFolder.get(k) || undefined : undefined;
  const pad = density === "cozy" ? "py-3" : "py-1.5";
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8em.emSearchMailPh")} className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
        </div>
        {([["cozy", t("p8em.emCozy")], ["compact", t("p8em.emCompact")]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setDensity(k)} className="rounded-full px-4 py-2 text-[13px] font-bold" style={density === k ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff" } : { border: "1px solid var(--line)", color: "var(--ink-2)", background: "#fff" }}>{l}</button>)}
      </div>
      {/* min-w-0 on BOTH columns: a grid track defaults to a min-content
          floor, so one wide descendant (a long address, a nowrap row) pushes
          the whole grid past the viewport and the Inbox scrolls sideways. */}
      <div className="grid gap-3 md:grid-cols-[210px_1fr]">
        <div className="min-w-0">
          <button type="button" onClick={onCompose} className="mb-3 w-full rounded-full py-2.5 text-[14px] font-extrabold text-white shadow" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>{t("p8em.emCompose")}</button>
          <div className="flex flex-col">
            {FOLDERS.map(([k]) => { const n = count(k); return (
              <button key={k} type="button" onClick={() => setFolder(k)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-start text-[13px] font-semibold" style={folder === k ? { background: "#eef4fd", color: "#1d3a8f", fontWeight: 800 } : { color: "var(--ink-2)" }}>
                <span className="flex-1">{t("p8em.emFolder_" + k)}</span>{n ? <span className="rounded-full bg-[var(--panel)] px-1.5 text-[11px] font-bold text-[var(--ink-2)]">{n}</span> : null}
              </button>
            ); })}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
        <MailboxSetup />
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
            {([["all", t("p8em.cAll")], ["unread", t("p8em.emUnread")], ["starred", t("p8em.emFolder_starred")], ["files", t("p8em.emHasFiles")]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className="rounded-full px-3 py-1 text-[12.5px] font-bold" style={filter === k ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff" } : { border: "1px solid var(--line)", color: "var(--ink-2)" }}>{l}</button>)}
            <span className="ms-auto text-[12px] text-[var(--ink-3)]">{list.length ? t("p8em.emRange", { n: list.length }) : "0"}</span>
          </div>
          {list.length === 0 ? <div className="px-4 py-14 text-center text-[13px] text-[var(--ink-3)]">{folder === "inbox" && !items.length ? t("p8em.emNoMail") : t("p8em.emNothingHere")}</div>
          : list.map((m) => (
            <div key={m.id} className={`flex w-full items-center gap-3 border-b border-[var(--line)] px-3 last:border-0 hover:bg-[#f7faff] ${pad}`} style={m.unread ? { background: "#f2f7ff" } : undefined}>
              <span className="flex-none" style={{ width: 6 }}>{m.unread && <span className="block h-2 w-2 rounded-full" style={{ background: "#2f6bd8" }} />}</span>
              <button type="button" onClick={() => star(m)} className="flex-none text-[15px]" style={{ color: m.starred ? "#f4b400" : "var(--ink-3)" }} aria-label={m.starred ? t("p8em.emUnstar") : t("p8em.emStar")}>{m.starred ? "★" : "☆"}</button>
              <button type="button" onClick={() => openMail(m)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                <span className={`w-[140px] flex-none truncate text-[13.5px] ${m.unread ? "font-extrabold text-[var(--ink)]" : "font-normal text-[var(--ink-2)]"}`}>{m.from}{m.thread && <span className="text-[var(--ink-3)]"> »</span>}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]"><span className={m.unread ? "font-extrabold text-[var(--ink)]" : "font-normal text-[var(--ink-2)]"}>{m.subject}</span> <span className="text-[var(--ink-3)]">— {m.preview}</span></span>
                {m.labels?.map((l) => <span key={l} className="flex-none rounded-md px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: LABEL_STYLE[l].bg, color: LABEL_STYLE[l].fg }}>{t("p8em.emLabel_" + l)}</span>)}
                {m.attachment && <span className="flex-none text-[13px] text-[var(--ink-3)]" title={m.attachment}>📎</span>}
                <span className="flex-none text-[12px] font-semibold text-[var(--ink-3)]">{m.time}</span>
              </button>
              {folder === "sent" ? null : folder === "scheduled" ? (
                <button type="button" onClick={() => cancelScheduled(m)} className="flex-none rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-3)] hover:border-[#e2b4b8] hover:text-[#c02636]" title={t("p8em.emCancelSchedTip")}>{t("p8em.emCancelX")}</button>
              ) : restorable ? <>
                <button type="button" onClick={() => restore(m)} className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[#1d3a8f]" title={t("p8em.emMoveInbox")}>↩</button>
                <button type="button" onClick={() => del(m)} className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[#c02636]" title={folder === "trash" ? t("p8em.emDeleteForever") : t("p8em.emMoveTrash")}>🗑</button>
              </> : <>
                <button type="button" onClick={() => archive(m)} className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)]" title={t("p8em.emFolder_archive")}>🗄</button>
                <button type="button" onClick={() => del(m)} className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[#c02636]" title={t("p8em.emMoveTrash")}>🗑</button>
              </>}
            </div>
          ))}
        </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] px-3 py-2 text-[11.5px] text-[#1d3a8f]">{t("p8em.emInboxFoot")}</div>
      {open && (() => { const o = open; const initials = o.from.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        const toolBtn = "flex-none rounded-full border border-[#E4E9F5] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-bold text-[#2f5fd0] shadow-[0_1px_2px_rgba(20,40,90,.06)] transition-colors hover:border-[#2f6bd8] hover:text-[#2f5fd0]";
        return (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#0b1730]/50 p-4 pt-[5vh] backdrop-blur-[2px]" onClick={() => setOpen(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-[var(--surface)] shadow-2xl ring-1 ring-[#2f5fd0]/10" onClick={(e) => e.stopPropagation()}>
            {/* blue gradient header */}
            <div className="px-6 py-4 text-white" style={{ background: "radial-gradient(120% 160% at 8% -30%, #4f8bf5 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#2f6bd8 100%)" }}>
              <div className="flex items-start gap-2">
                <span className="text-[19px] font-extrabold leading-snug" style={{ fontFamily: "var(--ff-display)" }}>{o.subject}</span>
                <button type="button" onClick={() => setOpen(null)} className="ms-auto flex h-7 w-7 flex-none items-center justify-center rounded-full text-[16px] text-white/85 hover:bg-white/20">×</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">{o.labels?.map((l) => <span key={l} className="rounded-md px-2 py-0.5 text-[11px] font-extrabold" style={{ background: LABEL_STYLE[l].bg, color: LABEL_STYLE[l].fg }}>{t("p8em.emLabel_" + l)}</span>)}{o.tag && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white/90">🏷 {o.tag}</span>}</div>
            </div>
            {/* toolbar — file/flag actions only exist for real stored messages */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[#f5f8fd] px-4 py-2.5">
              <button type="button" onClick={() => setOpen(null)} className={toolBtn}>{t("p8em.cBack")}</button>
              {o.folder === "scheduled" && <button type="button" onClick={() => cancelScheduled(o)} className="flex-none rounded-full border border-[#E4E9F5] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-bold text-[#2f5fd0] shadow-[0_1px_2px_rgba(20,40,90,.06)] transition-colors hover:border-[#e2b4b8] hover:text-[#C81E5E]">{t("p8em.emCancelSend")}</button>}
              {isMsg(o.id) && <>
                {o.folder && o.folder !== "inbox"
                  ? <button type="button" onClick={() => restore(o)} className={toolBtn}>{t("p8em.emMoveInboxBtn")}</button>
                  : <button type="button" onClick={() => archive(o)} className={toolBtn}>{t("p8em.emArchiveBtn")}</button>}
                <button type="button" onClick={() => snooze(o)} className={toolBtn} title={t("p8em.emSnoozeTip")}>{t("p8em.emSnooze")}</button>
                <button type="button" onClick={() => markUnread(o)} className={toolBtn}>{t("p8em.emUnreadBtn")}</button>
                <button type="button" onClick={() => spam(o)} className={toolBtn}>{t("p8em.emSpamBtn")}</button>
                <button type="button" onClick={() => del(o)} className="flex-none rounded-full border border-[#E4E9F5] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-bold text-[#2f5fd0] shadow-[0_1px_2px_rgba(20,40,90,.06)] transition-colors hover:border-[#e2b4b8] hover:text-[#C81E5E]">{o.folder === "trash" ? "🗑 " + t("p8em.emDeleteForever") : t("p8em.emDeleteBtn")}</button>
              </>}
              <button type="button" onClick={() => setShowContact((v) => !v)} className={`${toolBtn} ms-auto`} title={t("p8em.emContactTip")}>{t("p8em.emContactBtn")}</button>
            </div>
            {/* Reply / Forward / Mark as enquiry — also at the top so they're
                reachable without scrolling past a long message. */}
            {isMsg(o.id) && <div className="flex flex-wrap gap-2 border-b border-[var(--line)] px-6 py-3">
              <button type="button" onClick={() => reply(o)} className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white shadow-[0_3px_10px_-2px_rgba(47,107,216,.5)]" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{t("p8em.emReply")}</button>
              {(o.cc?.length ?? 0) > 0 && <button type="button" onClick={() => reply(o)} className="rounded-lg border border-[#dbe6fb] px-4 py-2 text-[13px] font-bold text-[#2a3a63] hover:border-[#2f6bd8] hover:text-[#1d3a8f]">{t("p8em.emReplyAll")}</button>}
              <button type="button" onClick={() => forward(o)} className="rounded-lg border border-[#dbe6fb] px-4 py-2 text-[13px] font-bold text-[#2a3a63] hover:border-[#2f6bd8] hover:text-[#1d3a8f]">{t("p8em.emForward")}</button>
              <button type="button" onClick={() => { setEnqLocs([]); setEnqFor(o); }} className="ms-auto rounded-lg border border-[#bfe6cf] px-4 py-2 text-[13px] font-bold text-[#127a3e] hover:bg-[#eafaf0]" title={t("p8em.emMarkEnquiryTip")}>{t("p8em.emMarkEnquiry")}</button>
            </div>}
            {/* message */}
            <div className="px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-white shadow-[0_2px_6px_rgba(47,107,216,.35)]" style={{ background: "linear-gradient(135deg,#3f78d8,#16306e)" }}>{initials}</span>
                <div className="min-w-0 flex-1"><div className="text-[14.5px] font-extrabold text-[var(--ink)]">{o.from}</div><div className="text-[12.5px] text-[var(--ink-3)]">{o.fromEmail}{o.to ? t("p8em.emToAddr", { to: o.to }) : ""}{o.cc?.length ? `, +${o.cc.length}` : ""}</div></div>
                <span className="flex-none text-[12.5px] font-semibold text-[var(--ink-3)]">{o.time}</span>
              </div>
              {showContact && <div className="mt-3 rounded-xl border border-[#dbe6fb] bg-[#f4f8ff] p-3 text-[12.5px]"><div className="font-extrabold text-[#1d3a8f]">{o.from}</div><div className="text-[var(--ink-3)]">{o.fromEmail}</div>{o.tag && <div className="mt-1 text-[var(--ink-2)]"><RichB text={t("p8em.emListLabel", { tag: o.tag })} /></div>}<div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{t("p8em.emContactHistory")}</div></div>}
              <p className="mt-4 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--ink-2)]">{linkify(o.body ?? o.preview)}</p>
              {o.attachment && <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">📎 {o.attachment}{o.attachmentSize && <span className="font-normal text-[var(--ink-3)]">{o.attachmentSize}</span>}</div>}
            </div>
            {o.quickReplies?.length ? <div className="border-t border-[var(--line)] bg-[#E8EEFD] px-6 py-3"><div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emQuickReplies")}</div><div className="flex flex-wrap gap-2">{o.quickReplies.map((qr) => <button key={qr} type="button" onClick={() => quickReply(o, qr)} className="rounded-full border border-[#E4E9F5] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#2f5fd0] transition-colors hover:border-[#2f6bd8] hover:bg-[#E8EEFD] hover:text-[#2f5fd0]">{qr}</button>)}</div></div> : null}
            {isMsg(o.id) && <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-6 py-3.5">
              <button type="button" onClick={() => reply(o)} className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white shadow-[0_3px_10px_-2px_rgba(47,107,216,.5)]" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{t("p8em.emReply")}</button>
              {(o.cc?.length ?? 0) > 0 && <button type="button" onClick={() => reply(o)} className="rounded-lg border border-[#dbe6fb] px-4 py-2 text-[13px] font-bold text-[#2a3a63] hover:border-[#2f6bd8] hover:text-[#1d3a8f]">{t("p8em.emReplyAll")}</button>}
              <button type="button" onClick={() => forward(o)} className="rounded-lg border border-[#dbe6fb] px-4 py-2 text-[13px] font-bold text-[#2a3a63] hover:border-[#2f6bd8] hover:text-[#1d3a8f]">{t("p8em.emForward")}</button>
              <button type="button" onClick={() => { setEnqLocs([]); setEnqFor(o); }} className="ms-auto rounded-lg border border-[#bfe6cf] px-4 py-2 text-[13px] font-bold text-[#127a3e] hover:bg-[#eafaf0]" title={t("p8em.emMarkEnquiryTip")}>{t("p8em.emMarkEnquiry")}</button>
            </div>}
          </div>
        </div>
      ); })()}
      {enqFor && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onClick={() => setEnqFor(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--surface)] shadow-2xl ring-1 ring-[#2f5fd0]/10" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-t-2xl px-5 py-4 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
              <div className="text-[15px] font-extrabold">{t("p8em.emEnqTitle")}</div>
              <div className="text-[12.5px] text-white/80">{t("p8em.emEnqWhich", { from: enqFor.from })}</div>
            </div>
            <div className="p-5">
              <FieldLabel>{t("p8em.nfLocation")}{locations.length > 0 && <span className="ms-1 font-normal normal-case tracking-normal text-[var(--ink-3)]">{t("p8em.emPickMore")}</span>}</FieldLabel>
              {locations.length === 0
                ? <p className="text-[12.5px] text-[var(--ink-3)]">{t("p8em.emEnqNoVenues")}</p>
                : <div className="flex flex-wrap gap-2">
                    {locations.map((l) => { const on = enqLocs.includes(l); return (
                      <button key={l} type="button" onClick={() => setEnqLocs((xs) => xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l])} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${on ? "bg-[#16306e] text-white shadow-sm" : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>{on ? "✓ " : ""}{l}</button>
                    ); })}
                  </div>}
              <p className="mt-2.5 text-[11.5px] text-[var(--ink-3)]">{enqLocs.length === 0 ? t("p8em.emEnqNone") : pickPlural(t, locale, "p8em.emEnqBoards", enqLocs.length)} {t("p8em.emDropsOff")}</p>
              <div className="mt-5 flex items-center gap-2">
                {enqLocs.length > 0 && <button type="button" onClick={() => setEnqLocs([])} className="me-auto text-[12px] font-bold text-[var(--ink-3)] hover:text-[#1d3a8f]">{t("p8em.cClear")}</button>}
                <button type="button" onClick={() => setEnqFor(null)} className="ms-auto rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.cCancel")}</button>
                <button type="button" onClick={() => { onEnquiry(enqFor, enqLocs); setEnqFor(null); setOpen(null); }} className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white shadow-sm" style={{ background: "linear-gradient(180deg,#33b06a,#127a3e)" }}>{t("p8em.emAddToEnquiries")}</button>
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
/** The listing a booking is for, whichever field name it arrived under. */
const bookingListing = (b: { listing?: string; title?: string; listingTitle?: string }) =>
  (b.listing || b.title || b.listingTitle || "").trim() || undefined;
/** Who made the booking — `booker` is the real field; `name` is a legacy alias. */
const bookerName = (b: { booker?: string; name?: string }) => (b.booker || b.name || "").trim() || undefined;

// Mirrors the slice of features/bookings/types.ts the composer needs. `listing`
// (the name) and `booker` are what the API actually sends — `title`/
// `listingTitle`/`name` are kept only because older rows and other callers use
// them; matching that relied on those alone silently found nothing.
interface Booking { id?: string; email?: string; booker?: string; name?: string; child?: string; age?: number; listingId?: string; listing?: string; title?: string; listingTitle?: string; locationName?: string; date?: string; dates?: string; createdAt?: string; method?: string }
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
  const out: Audience[] = [{ id: "enq-all", name: tNow("p8em.emEnqAudAll"), count: all.size, emails: [...all.keys()], people: ppl(all), desc: tNow("p8em.emEnqDescAll") }];
  for (const [loc, ems] of byLoc) out.push({ id: `enq-${loc}`, name: tNow("p8em.emEnqAudLoc", { loc: loc === "No location" ? tNow("p8em.emNoLocation") : loc }), count: ems.size, emails: [...ems.keys()], people: ppl(ems), desc: tNow("p8em.emEnqDescLoc", { loc: loc === "No location" ? tNow("p8em.emNoLocation") : loc }) });
  return out;
}
const STATUS_PILL: Record<CampStatus, { bg: string; fg: string; label: string }> = {
  sent: { bg: "#dff3e6", fg: "#127a3e", label: "Sent" }, sending: { bg: "#fdeccf", fg: "#9a5a00", label: "Sending" },
  scheduled: { bg: "#e4edfd", fg: "#1d3a8f", label: "Scheduled" }, draft: { bg: "var(--panel)", fg: "var(--ink-2)", label: "Draft" },
};
const parseDate = (s?: string) => { if (!s) return null; const t = Date.parse(s); return Number.isNaN(t) ? null : new Date(t); };
const bookedDate = (b: Booking) => parseDate(b.createdAt);           // when the booking was MADE
const sessionDate = (b: Booking) => parseDate(b.date || b.createdAt); // when the child ATTENDS
const fmtD = (s?: string) => { const d = parseDate(s); return d ? d.toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric" }) : ""; };
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
  const t = tNow;
  const b: string[] = [];
  if (f.location) b.push(f.location);
  if (f.listingIds?.length) b.push(f.listingIds.length === 1 ? (f.listingTitles?.[0] || t("p8em.emFd_aListing")) : t("p8em.emFd_nListings", { n: f.listingIds.length }));
  if (f.ageMin != null || f.ageMax != null) { const lo = f.ageMin ?? 0, hi = f.ageMax ?? 18; if (!(lo === 0 && hi === 18)) b.push(t("p8em.emFd_ages", { lo, hi: hi >= 18 ? "18+" : hi })); }
  if (f.from || f.to) { const w = f.dateType === "session" ? t("p8em.emFd_attending") : f.dateType === "either" ? t("p8em.emFd_either") : t("p8em.emFd_booked"); b.push(t("p8em.emFd_range", { w, from: f.from || "…", to: f.to || "…" })); }
  if (f.when === "upcoming") b.push(t("p8em.emFd_upcoming")); if (f.when === "past") b.push(t("p8em.emFd_past"));
  if (f.repeatOnly) b.push(t("p8em.emFd_repeat"));
  return b.length ? b.join(" · ") : t("p8em.emFd_all");
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div><div className="mt-1 text-[26px] font-extrabold" style={{ color: tone ?? "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{value}</div>{sub && <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{sub}</div>}</div>;
}
function FunnelBar({ label, n, max, color }: { label: string; n: number; max: number; color: string }) {
  return <div className="mb-2.5"><div className="flex justify-between text-[13px]"><span className="text-[var(--ink-2)]">{label}</span><span className="font-bold text-[var(--ink)]">{n}</span></div><div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${max ? Math.round((n / max) * 100) : 0}%`, background: color }} /></div></div>;
}

function AudienceBuilder({ bookings, listings, locations, onCancel, onCreate }: { bookings: Booking[]; listings: { id: string; title: string; location?: string; runFrom?: string; runTo?: string }[]; locations: string[]; onCancel: () => void; onCreate: (a: Audience, useNow: boolean) => void }) {
  const t = useT();
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
    return ds.length ? `${ds[0].toLocaleDateString(dl(), { day: "numeric", month: "short" })} – ${ds[ds.length - 1].toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric" })}` : t("p8em.emDatesNA");
  };
  const AGES = Array.from({ length: 19 }, (_, i) => i); // 0..18 (18 = 18+)
  const lo = f.ageMin ?? 0, hi = f.ageMax ?? 18;
  const mk = (): Audience => ({ id: `aud-${name.trim() || "seg"}-${seq.current++}`, name: name.trim() || filterDesc(f), count, emails, desc: filterDesc(f), filter: f });
  const seg = (opts: [string, string][], val: string, on: (v: string) => void) => (
    <div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)]">{opts.map(([v, l]) => <button key={v} type="button" onClick={() => on(v)} className="px-3 py-1.5 text-[12px] font-bold transition-colors" style={val === v ? { background: "#eef4fd", color: "#1d3a8f" } : { color: "var(--ink-2)" }}>{l}</button>)}</div>
  );
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onCancel}>
      <div className="w-full max-w-xl rounded-2xl bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0f9d58] text-white">●</span>
          <div><div className="text-[16px] font-extrabold text-[var(--ink)]">{t("p8em.emAudBuild")}</div><div className="text-[12px] text-[var(--ink-3)]">{t("p8em.emAudFilterSub")}</div></div>
          <button type="button" onClick={onCancel} className="ms-auto flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[var(--ink-3)] hover:bg-[var(--panel)]">×</button>
        </div>
        <div className="max-h-[62vh] space-y-3.5 overflow-y-auto p-5">
          <div><FieldLabel>{t("p8em.nfLocation")}</FieldLabel><Select value={f.location ?? ""} onChange={(e) => set({ location: e.target.value || undefined, listingIds: [], listingTitles: [] })} className="w-full"><option value="">{t("p8em.emAnyLocation")}</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
          <div>
            <div className="mb-1 flex items-center justify-between"><FieldLabel>{t("p8em.emAudListings")}</FieldLabel>{listingsHere.length > 0 && <span className="flex gap-2 text-[11.5px] font-bold"><button type="button" onClick={() => set({ listingIds: listingsHere.map((l) => l.id), listingTitles: listingsHere.map((l) => l.title) })} className="text-[#1d3a8f]">{t("p8em.emSelectAll")}</button>{f.listingIds?.length ? <button type="button" onClick={() => set({ listingIds: [], listingTitles: [] })} className="text-[var(--ink-3)]">{t("p8em.cClear")}</button> : null}</span>}</div>
            <div className="flex flex-wrap gap-1.5">
              {listingsHere.length === 0 ? <span className="text-[11.5px] text-[var(--ink-3)]">{f.location ? t("p8em.emNoListingsIn", { loc: f.location }) : t("p8em.nfNoListings")}</span>
                : listingsHere.map((l) => { const on = f.listingIds?.includes(l.id); return <button key={l.id} type="button" onClick={() => { const ids = new Set(f.listingIds ?? []); const titles = new Set(f.listingTitles ?? []); if (on) { ids.delete(l.id); titles.delete(l.title); } else { ids.add(l.id); titles.add(l.title); } set({ listingIds: [...ids], listingTitles: [...titles] }); }} className="rounded-lg border px-2.5 py-1.5 text-[12px] font-bold" style={on ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{l.title} <span className="font-normal text-[var(--ink-3)]">· {runLabel(l)}</span></button>; })}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--line)] p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><FieldLabel>{t("p8em.emDateRange")}</FieldLabel>{seg([["booked", t("p8em.emDt_booked")], ["session", t("p8em.emDt_session")], ["either", t("p8em.emDt_either")]], f.dateType ?? "booked", (v) => set({ dateType: v as AudFilter["dateType"] }))}</div>
            <div className="grid grid-cols-2 gap-2.5"><Input type="date" value={f.from ?? ""} onChange={(e) => set({ from: e.target.value })} className="w-full" /><Input type="date" value={f.to ?? ""} onChange={(e) => set({ to: e.target.value })} className="w-full" /></div>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]"><RichB text={t("p8em.emDateRangeHint")} /></p>
          </div>
          <div><FieldLabel>{t("p8em.emAgeOfChild")}</FieldLabel>
            {(() => { const allAges = f.ageMin == null && f.ageMax == null; return (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => set({ ageMin: undefined, ageMax: undefined })} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${allAges ? "bg-[#16306e] text-white shadow-sm" : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>{t("p8em.emAllAges")}</button>
                <span className="text-[12.5px] text-[var(--ink-3)]">{t("p8em.emOrPickRange")}</span>
                <span className="text-[12.5px] text-[var(--ink-2)]">{t("p8em.emFrom")}</span>
                <Select value={allAges ? "" : String(lo)} onChange={(e) => set({ ageMin: Number(e.target.value), ageMax: f.ageMax ?? 18 })} className="w-20">{allAges && <option value="">–</option>}{AGES.map((a) => <option key={a} value={a}>{a}</option>)}</Select>
                <span className="text-[12.5px] text-[var(--ink-2)]">{t("p8em.emTo")}</span>
                <Select value={allAges ? "" : String(hi)} onChange={(e) => set({ ageMin: f.ageMin ?? 0, ageMax: Number(e.target.value) })} className="w-20">{allAges && <option value="">–</option>}{AGES.map((a) => <option key={a} value={a}>{a === 18 ? "18+" : a}</option>)}</Select>
              </div>
            ); })()}
          </div>
          <div className="rounded-xl border border-[var(--line)] p-3">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emMoreFilters")}</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] text-[var(--ink-2)]">{t("p8em.emSessions")}</span>{seg([["any", t("p8em.emAny")], ["upcoming", t("p8em.emUpcoming")], ["past", t("p8em.emPast")]], f.when ?? "any", (v) => set({ when: v as AudFilter["when"] }))}
              <label className="ms-2 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={!!f.repeatOnly} onChange={(e) => set({ repeatOnly: e.target.checked })} /> {t("p8em.emRepeatOnly")}</label>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[var(--panel)] p-3.5">
            <div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emMatching")}</div><div className="text-[30px] font-extrabold leading-none text-[#2f6bd8]" style={{ fontVariantNumeric: "tabular-nums" }}>{count}</div><div className="text-[10px] text-[var(--ink-3)]">{t("p8em.emCustomers")}</div></div>
            <div className="text-[13px] font-semibold text-[var(--ink-2)]">{filterDesc(f)}</div>
          </div>
          <div><FieldLabel>{t("p8em.emAudName")}</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("p8em.emNewAudPh")} className="w-full" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={() => onCreate(mk(), false)} className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>{t("p8em.emCreateAud")}</button>
          <button type="button" onClick={() => onCreate(mk(), true)} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.emCreateUseAud")}</button>
          <button type="button" onClick={onCancel} className="ms-auto rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-3)]">{t("p8em.cCancel")}</button>
        </div>
      </div>
    </div>
  );
}

function NewCampaign({ audiences, templates, initialAudienceId, initialName, initialSubject, restrictEmails, restrictLabel, company, socials, onCancel, onSubmit, onRemovePerson }: { audiences: Audience[]; templates: EmailTemplate[]; initialAudienceId?: string | null; initialName?: string; initialSubject?: string; restrictEmails?: Set<string>; restrictLabel?: string; company?: Partial<Company>; socials?: Social[]; onCancel: () => void; onSubmit: (c: { name: string; audience: Audience; template?: EmailTemplate; subject: string; html?: string; body?: string; design?: CampaignDesign; scheduledAt?: string }, action: CampStatus) => void | Promise<void>; onRemovePerson?: (email: string) => void }) {
  const { t, locale } = useI18n();
  const [name, setName] = useState(initialName ?? "");
  const [audIds, setAudIds] = useState<string[]>(initialAudienceId ? [initialAudienceId] : (audiences[0] ? [audiences[0].id] : []));
  const [tmplId, setTmplId] = useState(templates[0]?.id ?? "");
  const [tmplBody, setTmplBody] = useState(() => templates[0]?.body ?? "");   // editable copy of the worded template
  const [aiBusy, setAiBusy] = useState(false);
  const [cdOn, setCdOn] = useState(false);   // add a big countdown clock to a worded email
  const [cdDate, setCdDate] = useState("");
  const [cdTime, setCdTime] = useState("");
  const [cdHeading, setCdHeading] = useState(() => tNow("p8em.emHurry"));
  const [subject, setSubject] = useState(initialSubject ?? "");
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
  // A growth-page "focus on <listing>" narrows every chosen audience to families who booked it.
  const people = [...peopleMap.values()].filter((p) => !restrictEmails || restrictEmails.has(p.email.toLowerCase()));
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
  const STEPS = [t("p8em.emStep_0"), t("p8em.emStep_1"), t("p8em.emStep_2"), t("p8em.emStep_3")];
  const lastStep = STEPS.length - 1;
  const nextDisabled = !!busy || (step === 1 && !primary);
  const submit = async (action: CampStatus) => {
    if (!primary) { setSendErr(t("p8em.emPickAudFirst")); return; }
    if (action === "scheduled" && !schedAt) { setSendErr(t("p8em.emPickWhen")); return; }
    const subj = subject.trim() || template?.subject || name.trim();
    const baseName = selectedAuds.length > 1 ? t("p8em.emPlusMore", { name: primary.name, n: selectedAuds.length - 1 }) : primary.name;
    const combined: Audience = { id: primary.id, name: restrictLabel ? `${baseName} · ${restrictLabel}` : baseName, count: included.length, emails: included.map((p) => p.email), desc: restrictLabel ? t("p8em.emWhoBookedPlain", { desc: primary.desc, label: restrictLabel }) : primary.desc };
    setSendErr(null); setBusy(action);
    try {
      const html = useDesign && design ? renderDesignHtml(design, company, nowMs) : (mode === "template" && wordedHasCountdown ? renderDesignHtml(wordedDesign(), company, nowMs) : undefined);
      await onSubmit({ name: name.trim() || subj || t("p8em.emUntitledCampaign"), audience: combined, template: mode === "template" ? template : undefined, subject: subj, html, body: useDesign && design ? renderDesignText(design) : (mode === "template" ? tmplBody.trim() || undefined : undefined), design: useDesign ? (design ?? undefined) : undefined, scheduledAt: action === "scheduled" ? schedAt : undefined }, action);
      if (action === "sent") { if (useDesign) { setSaveName(name.trim() || subject.trim() || t("p8em.emMyDesign")); setSentOk(true); } else onCancel(); }   // designed send → offer to save; worded → just close
    } catch (e) { setSendErr(e instanceof Error ? e.message : t("p8em.emSendFailed")); }
    finally { setBusy(null); }
  };
  const pickTemplate = (id: string) => { setTmplId(id); setTmplBody(templates.find((t) => t.id === id)?.body ?? ""); };
  const insertMerge = (token: string) => setTmplBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}${token}`);
  const aiWrite = async () => {
    const notes = window.prompt(t("p8em.emAiPrompt"));
    if (!notes?.trim()) return;
    setAiBusy(true); setSendErr(null);
    try { const r = await apiPost<{ title: string; body: string }>("/api/ai/compose", { kind: "announce", notes: notes.trim(), length: "medium" }); if (r.title && !subject.trim()) setSubject(r.title); if (r.body) setTmplBody((b) => (b.trim() ? `${b}\n\n${r.body}` : r.body)); }
    catch (e) { setSendErr(e instanceof Error ? e.message : t("p8em.nfAiFail")); }
    finally { setAiBusy(false); }
  };
  // Reuse a previous campaign — pull its content across, then edit via the steps.
  // Reuse a previously-saved design — load it so it can be edited. Shared with the
  // designer's ⭐ My templates store, so a post-send save shows up in both places.
  const reuseSaved = (s: SavedTemplate) => { if (!name.trim()) setName(s.name ? `${s.name} (copy)` : ""); setMode("design"); setDesign({ templateId: "", accent: s.accent, blocks: s.blocks }); };
  const saveCurrentDesign = () => { if (!design) return; const nm = saveName.trim() || t("p8em.emSavedDesign"); const item: SavedTemplate = { id: `sv-${nowMs}`, name: nm, accent: design.accent, blocks: design.blocks }; const next = [item, ...savedDesigns.filter((x) => x.name !== nm)]; setSavedDesigns(next); persistMyTemplates(next); };
  // One-click countdown for the current design (templates don't include one) — adds a dated countdown so the clock shows.
  const addCountdownToDesign = () => { const d = new Date(Date.now() + 14 * 86400000); const p = (n: number) => String(n).padStart(2, "0"); const dateStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; setDesign((dz) => { if (!dz) return dz; const idx = dz.blocks.findIndex((b) => b.t === "countdown"); if (idx >= 0) return { ...dz, blocks: dz.blocks.map((b, i) => (i === idx ? { ...b, date: b.date || dateStr, time: b.time || "18:00" } : b)) }; return { ...dz, blocks: [...dz.blocks, { t: "countdown", heading: t("p8em.emHurry"), label: "", date: dateStr, time: "18:00" } as Block] }; }); };
  // Same one-click default for a worded email — cdOn alone isn't enough to
  // show the clock (wordedHasCountdown also needs cdDate), so seed it here
  // rather than leaving cdOn true with no date, which would just show the
  // "no date set" warning instead of ever including the clock.
  const addCountdownToWorded = () => {
    if (!cdDate) { const d = new Date(Date.now() + 14 * 86400000); const p = (n: number) => String(n).padStart(2, "0"); setCdDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`); }
    if (!cdTime) setCdTime("18:00");
    setCdOn(true);
  };
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
      <div className="w-full max-w-5xl rounded-2xl bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <style>{`.camp-scroll{overflow-y:scroll}.camp-scroll::-webkit-scrollbar{width:14px}.camp-scroll::-webkit-scrollbar-track{background:#e7ecf4;border-radius:8px}.camp-scroll::-webkit-scrollbar-thumb{background:#8aa0c6;border-radius:8px;border:3px solid #e7ecf4;min-height:44px}.camp-scroll::-webkit-scrollbar-thumb:hover{background:#5f7cab}`}</style>
        <div className="rounded-t-2xl px-6 py-4 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="text-[19px] font-extrabold">{t("p8em.emNewCampaign")}</div><div className="truncate text-[12.5px] text-white/80">{primary ? <RichB className="font-extrabold text-white" text={t("p8em.emHdrTo", { name: audTitle(t, primary), more: selectedAuds.length > 1 ? t("p8em.emHdrMore", { n: selectedAuds.length - 1 }) : "", who: restrictLabel ? t("p8em.emHdrWho", { label: restrictLabel }) : "", n: included.length })} /> : t("p8em.emHdrFallback")}</div></div>
            <div className="flex flex-none items-center gap-3"><span className="text-[12px] font-bold text-white/85">{t("p8em.emStepOf", { a: step + 1, b: STEPS.length })}</span><button type="button" onClick={onCancel} disabled={!!busy} title={t("p8em.cCancel")} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[16px] font-bold hover:bg-white/30 disabled:opacity-40">×</button></div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {STEPS.map((s, i) => <button key={s} type="button" onClick={() => setStep(i)} title={s} className="flex-1"><div className={`h-1.5 rounded-full transition ${i <= step ? "bg-[var(--surface)]" : "bg-white/25"}`} /></button>)}
          </div>
        </div>
        <div className="camp-scroll max-h-[64vh] bg-[#f4f7fc] px-8 py-6">
          <div className="mx-auto flex min-h-[210px] max-w-2xl flex-col">
            {step === 0 && <div className="space-y-5">
              <div><div className="text-[27px] font-extrabold leading-tight tracking-tight text-[#16306e]">{t("p8em.emNameTitle")}</div><p className="mt-1.5 text-[14.5px] text-[var(--ink-3)]">{t("p8em.emNameSub")}</p></div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("p8em.emNamePh")} className="w-full rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-[19px] font-semibold text-[var(--ink)] shadow-sm outline-none transition focus:border-[#2f5fd0]" />
            </div>}
            {step === 1 && <div className="space-y-5">
              <div><div className="text-[27px] font-extrabold leading-tight tracking-tight text-[#16306e]">{t("p8em.emWhoTitle")}</div><p className="mt-1.5 text-[14.5px] text-[var(--ink-3)]">{t("p8em.emWhoSub")}</p></div>
              <div className="flex flex-wrap gap-2">{selectedAuds.map((a) => <span key={a.id} className="inline-flex items-center gap-2 rounded-full bg-[#eef4fd] px-4 py-2 text-[14px] font-bold text-[#1d3a8f]">{audTitle(t, a)} <span className="rounded-full bg-white/70 px-1.5 text-[12px]">{a.count}</span>{selectedAuds.length > 1 && <button type="button" onClick={() => removeAud(a.id)} className="text-[#1d3a8f]/50 hover:text-[#c02636]" title={t("p8em.emRemoveFromSend")}>✕</button>}</span>)}</div>
              {availableToAdd.length > 0 && <Select value="" onChange={(e) => addAud(e.target.value)} className="w-full max-w-md"><option value="">{t("p8em.emAddAnotherAud")}</option>{segG.length > 0 && <optgroup label={t("p8em.emGrpGroups")}>{segG.map((a) => <option key={a.id} value={a.id}>{audTitle(t, a)} ({a.count})</option>)}</optgroup>}{enqG.length > 0 && <optgroup label={t("p8em.emGrpEnquiries")}>{enqG.map((a) => <option key={a.id} value={a.id}>{audTitle(t, a)} ({a.count})</option>)}</optgroup>}{cusG.length > 0 && <optgroup label={t("p8em.emGrpYourAud")}>{cusG.map((a) => <option key={a.id} value={a.id}>{audTitle(t, a)} ({a.count})</option>)}</optgroup>}</Select>}
              <div className="rounded-xl border border-[#E4E9F5] bg-[var(--surface)] px-4 py-3 text-[13.5px] font-semibold text-[#2f5fd0] shadow-sm"><RichB text={t("p8em.emReaches", { n: included.length, skipped: excluded.size > 0 ? t("p8em.emSkipped", { n: excluded.size }) : "" })} /></div>
            </div>}
            {step === 2 && <div className="space-y-5">
              <div><div className="text-[27px] font-extrabold leading-tight tracking-tight text-[#16306e]">{t("p8em.emSubjTitle")}</div><p className="mt-1.5 text-[14.5px] text-[var(--ink-3)]">{t("p8em.emSubjSub")}</p></div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("p8em.emSubjPh")} className="w-full rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-[19px] font-semibold text-[var(--ink)] shadow-sm outline-none transition focus:border-[#2f5fd0]" />
            </div>}
            {step === 3 && <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><div className="text-[27px] font-extrabold leading-tight tracking-tight text-[#16306e]">{t("p8em.emLookTitle")}</div><p className="mt-1.5 text-[14.5px] text-[var(--ink-3)]">{t("p8em.emLookSub")}</p></div>
                <div className="inline-flex overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[13px] font-bold shadow-sm">{([["template", t("p8em.emModeWorded")], ["design", t("p8em.emModeDesign")]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => { setMode(k); setChooseView(false); }} className="px-4 py-2.5" style={!chooseView && mode === k ? { background: "#E8EEFD", color: "#2f5fd0" } : { color: "var(--ink-2)" }}>{l}</button>)}</div>
              </div>
              {chooseView && <div className="rounded-2xl border-2 border-dashed border-[#E4E9F5] bg-[var(--surface)] p-8 text-center shadow-sm"><div className="text-[15px] font-extrabold text-[var(--ink)]">{t("p8em.emLookChoose")}</div><p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--ink-3)]"><RichB text={t("p8em.emLookTap")} /></p></div>}
              {!chooseView && <>
              {mode === "template"
                ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm"><Select value={tmplId} onChange={(e) => pickTemplate(e.target.value)} className="w-full"><option value="">{t("p8em.emStartBlank")}</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                    <div className="mt-3"><FieldLabel>{t("p8em.emSubjectLine")}</FieldLabel><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("p8em.emSubjEgReminder")} className="w-full" /></div>
                    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[#f4f7fc] px-3 py-2">
                        <button type="button" onClick={aiWrite} disabled={aiBusy} className="rounded-md border border-[#7c3aed] px-2 py-1 text-[11.5px] font-extrabold text-[#7c3aed] hover:bg-[#f5f0ff] disabled:opacity-50">{aiBusy ? t("p8em.emWritingSp") : t("p8em.nfHelpWrite")}</button>
                        <span className="mx-1 h-4 w-px bg-[var(--line)]" />
                        <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emInsert")}</span>
                        {MERGE_FIELDS.slice(0, 6).map((f) => <button key={f.token} type="button" title={t("p8em.mf_" + f.token.replace(/[{}]/g, ""))} onClick={() => insertMerge(f.token)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{f.token}</button>)}
                      </div>
                      <textarea value={tmplBody} onChange={(e) => setTmplBody(e.target.value)} rows={9} placeholder={t("p8em.emBodyPh")} className="w-full resize-y bg-[var(--surface)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setPreviewBig(true)} className="rounded-lg border border-[#dbe6fb] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">{t("p8em.emPreviewEmail")}</button><p className="text-[11.5px] text-[var(--ink-3)]">{t("p8em.emEditFreely")}</p></div>
                    {cdOn
                      ? <div className="mt-2 rounded-xl border border-[#bfe6cf] bg-[#eafaf0] p-3">
                          <div className="mb-2 flex items-center gap-2"><span className="text-[12.5px] font-extrabold text-[#127a3e]">{t("p8em.emCdClock")}</span><button type="button" onClick={() => setCdOn(false)} className="ms-auto text-[11.5px] font-bold text-[#127a3e] hover:underline">{t("p8em.cRemove")}</button></div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input type="date" value={cdDate} onChange={(e) => setCdDate(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none" />
                            <input type="time" value={cdTime} onChange={(e) => setCdTime(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none" />
                            <input value={cdHeading} onChange={(e) => setCdHeading(e.target.value)} placeholder={t("p8em.emHurry")} className="min-w-[180px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none" />
                          </div>
                        </div>
                      : <button type="button" onClick={addCountdownToWorded} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#bfe0c9] bg-[#f0faf3] px-4 py-2.5 text-[13px] font-extrabold text-[#127a3e] hover:bg-[#e3f6ea]">{t("p8em.emCdBtn")}</button>}
                  </div>
                : design
                  ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
                      <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">{t("p8em.emYourDesign")}</span><button type="button" onClick={() => setDesigning(true)} className="ms-auto rounded-lg border border-[#dbe6fb] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">{t("p8em.emEditBtn")}</button><button type="button" onClick={() => setPreviewBig(true)} className="rounded-lg border border-[#dbe6fb] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">{t("p8em.emPopOut")}</button><button type="button" onClick={() => setDesign(null)} className="rounded-lg border border-[#f0c9cd] px-3 py-1.5 text-[12px] font-bold text-[#c02636] hover:bg-[#fdecec]">{t("p8em.emDiscard")}</button></div>
                      {designCd
                        ? <div className="mb-2 rounded-lg border border-[#bfe6cf] bg-[#eafaf0] px-3 py-2 text-[12.5px] font-bold text-[#127a3e]">{t("p8em.emCdInDesign")}</div>
                        : <button type="button" onClick={addCountdownToDesign} className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#bfe0c9] bg-[#f0faf3] px-4 py-3 text-[13.5px] font-extrabold text-[#127a3e] hover:bg-[#e3f6ea]">{t("p8em.emCdAddBig")}</button>}
                      <button type="button" onClick={() => setPreviewBig(true)} title={t("p8em.emClickEnlarge")} className="block w-full cursor-zoom-in overflow-hidden rounded-xl border border-[var(--line)] bg-[#E8EEFD] p-3"><div className="mx-auto max-h-80 max-w-[560px] overflow-hidden rounded-lg bg-[var(--surface)] shadow-sm" dangerouslySetInnerHTML={{ __html: renderDesignHtml(design, company, nowMs) }} /></button>
                    </div>
                  : <div className="rounded-2xl border-2 border-dashed border-[#E4E9F5] bg-[var(--surface)] p-8 text-center shadow-sm">
                      <div className="text-[16px] font-extrabold text-[var(--ink)]">{t("p8em.emDesignOwnTitle")}</div>
                      <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--ink-3)]">{t("p8em.emDesignOwnSub")}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                        <button type="button" onClick={() => setDesigning(true)} className="rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>{t("p8em.emGoBuilder")}</button>
                        {savedDesigns.length > 0 && <Select value="" onChange={(e) => { const s = savedDesigns.find((x) => x.id === e.target.value); if (s) reuseSaved(s); }} className="max-w-[260px]"><option value="">{t("p8em.emUseSaved")}</option>{savedDesigns.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
                      </div>
                    </div>}
              {cdMissingDate && <div className="rounded-xl border border-[#f2c4c9] bg-[#fdf0f1] px-4 py-3 text-[13px] font-semibold text-[#c02636]">{useDesign ? t("p8em.emCdWarnDesigner") : t("p8em.emCdWarnPanel")}</div>}
              {cdIncluded && <div className="rounded-xl border border-[#bfe6cf] bg-[#eafaf0] px-4 py-3 text-[13px] font-semibold text-[#127a3e]">{t("p8em.emCdIncluded")}</div>}
              <div className="rounded-xl border border-[#E4E9F5] bg-gradient-to-r from-[#FFFFFF] to-[#FFFFFF] px-4 py-3 text-[13.5px] font-semibold text-[#2f5fd0] shadow-sm"><RichB text={t("p8em.emSendingTo", { n: included.length, skipped: excluded.size > 0 ? t("p8em.emSkipped", { n: excluded.size }) : "", deduped: selectedAuds.length > 1 ? t("p8em.emDeduped", { n: selectedAuds.length }) : "" })} /></div>
              {people.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
                  <button type="button" onClick={() => setShowList((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-start"><span className="text-[13px] font-extrabold text-[var(--ink)]">{t("p8em.emRecipients")}</span><span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[11.5px] font-extrabold text-[#1d3a8f] tabular-nums">{t("p8em.emNofN", { a: included.length, b: people.length })}</span><span className="ms-auto text-[12px] font-bold text-[var(--ink-3)]">{showList ? t("p8em.emHideUp") : t("p8em.emShowDown")}</span></button>
                  {showList && <div className="max-h-52 overflow-y-auto border-t border-[var(--line)]">
                    {people.map((p) => { const off = excluded.has(p.email.toLowerCase()); return (
                      <div key={p.email} className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2 last:border-0">
                        <div className="min-w-0 flex-1"><div className={`truncate text-[13px] font-semibold ${off ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"}`}>{p.name || p.email}</div>{p.name && p.name !== p.email && <div className="truncate text-[11.5px] text-[var(--ink-3)]">{p.email}</div>}</div>
                        <button type="button" onClick={() => toggleExclude(p.email)} className={`flex-none rounded-full border px-2.5 py-1 text-[11px] font-bold ${off ? "border-[#bfe6cf] text-[#127a3e] hover:bg-[#eafaf0]" : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>{off ? t("p8em.emAddBack") : t("p8em.emSkipThisSend")}</button>
                        {enqEmails.has(p.email.toLowerCase()) && onRemovePerson && <button type="button" onClick={() => onRemovePerson(p.email)} className="flex-none rounded-full border border-[#f0c9cd] px-2.5 py-1 text-[11px] font-bold text-[#c02636] hover:bg-[#fdecec]" title={t("p8em.emRemoveEnqTip")}>{t("p8em.emRemoveBtn")}</button>}
                      </div>
                    ); })}
                  </div>}
                  <div className="border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--ink-3)]">{hasEnquiryAud ? t("p8em.emSkipNoteEnq") : t("p8em.emSkipNote")} {t("p8em.emDupMerged")}</div>
                </div>
              )}
              <p className="text-[12px] text-[var(--ink-3)]">{t("p8em.emOptedOutNote")}</p>
              </>}
            </div>}
          </div>
        </div>
        {sendErr && <div className="mx-6 mt-3 flex items-start gap-2 rounded-lg border border-[#f2c4c9] bg-[#fdf0f1] px-3 py-2 text-[12.5px] font-semibold text-[#c02636]"><span>⚠</span><span>{sendErr}</span></div>}
        <div className="flex items-center gap-2 border-t border-[var(--line)] px-6 py-3.5">
          <button type="button" onClick={() => { if (step === 0) return onCancel(); if (step === lastStep && !chooseView) return setChooseView(true); setChooseView(false); setStep(step - 1); }} disabled={!!busy} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-40">{step === 0 ? t("p8em.cCancel") : t("p8em.cBack")}</button>
          <div className="ms-auto flex items-center gap-2">
            {step < lastStep
              ? <button type="button" onClick={() => setStep(step + 1)} disabled={nextDisabled} className="rounded-lg px-6 py-2 text-[13px] font-extrabold text-white shadow-sm disabled:opacity-40" style={{ background: "linear-gradient(180deg,#3f78d8,#1d3a8f)" }}>{t("p8em.emNext")}</button>
              : <>
                  <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-1.5 py-1"><input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} title={t("p8em.emScheduleFor")} className="rounded bg-transparent px-1 py-1 text-[12px] text-[var(--ink)] outline-none" /><button type="button" onClick={() => submit("scheduled")} disabled={!!busy || !contentReady || chooseView} className="rounded-md bg-[#1d3a8f] px-3 py-1.5 text-[12.5px] font-extrabold text-white hover:brightness-110 disabled:opacity-40">{busy === "scheduled" ? t("p8em.emScheduling") : t("p8em.emScheduleBtn")}</button></div>
                  <button type="button" onClick={() => submit("sent")} disabled={included.length === 0 || !contentReady || chooseView || !!busy} className="rounded-lg px-5 py-2 text-[13px] font-extrabold text-white disabled:opacity-40" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>{busy === "sent" ? t("p8em.emSending") : t("p8em.emSendNow")}</button>
                </>}
          </div>
        </div>
      </div>
    </div>
    {previewBig && (
      <div className="fixed inset-0 z-[140] flex flex-col bg-[#0b1730]/70 p-4 backdrop-blur-[2px]" onClick={() => setPreviewBig(false)}>
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 py-2 text-white"><span className="text-[13px] font-extrabold">{t("p8em.emPreviewTitle")}</span><span className="text-[12px] text-white/70">{t("p8em.emPreviewSub")}</span><button type="button" onClick={() => setPreviewBig(false)} className="ms-auto rounded-lg bg-white/15 px-3 py-1.5 text-[13px] font-bold hover:bg-white/25">{t("p8em.emCloseX")}</button></div>
        <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto max-w-[600px]" dangerouslySetInnerHTML={{ __html: renderDesignHtml(useDesign && design ? design : wordedDesign(), company, nowMs) }} />
        </div>
      </div>
    )}
    {/* Same fix as the other CampaignDesigner usage below: no wrapping div —
        it trapped the designer's z-index inside a z-145 stacking context
        that could never beat the app header's z-[300]. */}
    {designing && <CampaignDesigner initial={design} company={company} socials={socials} onCancel={() => setDesigning(false)} onSave={(d) => { setDesign(d); setDesigning(false); }} />}
    {sentOk && (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 text-center shadow-2xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f6ee] text-[24px]">✅</div>
          <div className="text-[18px] font-extrabold text-[var(--ink)]">{pickPlural(t, locale, "p8em.emSentFam", included.length)}</div>
          <p className="mx-auto mt-1.5 max-w-xs text-[13px] text-[var(--ink-3)]">{t("p8em.emSaveDesignAsk")}</p>
          <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={t("p8em.emSaveDesignPh")} className="mt-3 w-full rounded-lg border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-center text-[14px] font-semibold text-[var(--ink)] outline-none focus:border-[#2f5fd0]" />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-[var(--line)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.emNoThanks")}</button>
            <button type="button" onClick={() => { saveCurrentDesign(); onCancel(); }} disabled={!saveName.trim()} className="flex-1 rounded-lg py-2.5 text-[13px] font-extrabold text-white shadow-sm disabled:opacity-40" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>{t("p8em.emSaveIt")}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function useCampaignData() {
  const [rawBookings, setRawBookings] = useState<Booking[]>([]);
  const [rawListings, setRawListings] = useState<{ id: string; title: string; venueId?: string; runFrom?: string; runTo?: string; seasonId?: string | null }[]>([]);
  const [venueName, setVenueName] = useState<Record<string, string>>({}); // venueId → name
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [segments, setSegments] = useState<Audience[] | null>(null);
  const hoScope = useHoScope(); // re-read segments when head office switches network
  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setRawBookings).catch(() => {}); }, []);
  // Live CRM segments, membership computed server-side at request time. The
  // "seg-" prefix keeps them in the composer's Segments optgroup. (The server's
  // "enquiries" segment — customer list, never booked — complements the
  // marked-from-inbox enquiry boards below; both are real, different sources.)
  useEffect(() => {
    apiGet<{ id: string; name: string; desc: string; count: number; emails: string[]; people?: { email: string; name?: string }[] }[]>(withNet("/api/emails/audiences"))
      .then((s) => setSegments(s.filter((x) => x.id !== "all").map((x) => ({ ...x, id: `seg-${x.id}` }))))
      .catch(() => {});
  }, [hoScope]);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string; venueId?: string; runFrom?: string; runTo?: string; seasonId?: string | null }[]>("/api/listings?mine=1").then((l) => setRawListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing", venueId: x.venueId, runFrom: x.runFrom, runTo: x.runTo, seasonId: x.seasonId })))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ venues?: { id: string; name?: string; city?: string }[] } | null>("/api/library").then((lib) => setVenueName(Object.fromEntries((lib?.venues ?? []).map((v) => [v.id, v.name || v.city || tNow("p8em.emVenueWord")])))).catch(() => {}); }, []);
  useEffect(() => { apiGet<EmailTemplate[]>("/api/messages/templates").then(setTemplates).catch(() => setTemplates([])); }, []);
  // A listing's location = its venue's name. A booking inherits its listing's location.
  const listings = rawListings.map((l) => ({ ...l, location: l.venueId ? venueName[l.venueId] : undefined }));
  const locByListing = new Map(listings.map((l) => [l.id, l.location]));
  const bookings = rawBookings.map((b) => ({ ...b, locationName: b.locationName || locByListing.get(b.listingId || "") }));
  const locations = [...new Set([...listings.map((l) => l.location), ...bookings.map((b) => b.locationName)].filter((x): x is string => !!x))].sort();
  const allEmails = resolveAudience(bookings, {}).emails;
  const emailName = new Map<string, string>(); for (const b of bookings) { const e = b.email?.toLowerCase(); if (e && !emailName.has(e)) emailName.set(e, b.name || e); }
  const allAudience: Audience = { id: "all", name: tNow("p8em.emAllActiveFamilies"), count: allEmails.length, emails: allEmails, people: allEmails.map((e) => ({ email: e, name: emailName.get(e.toLowerCase()) })), desc: tNow("p8em.emAllActiveDesc") };
  const liveSegments = segments ?? [];
  return { bookings, listings, templates, locations, allAudience, liveSegments };
}

function CampaignsView({ onSent, seedAudienceId, seedName, seedSubject, seedListingId, onSeedConsumed, company, socials }: { onSent: () => void; seedAudienceId?: string | null; seedName?: string; seedSubject?: string; seedListingId?: string | null; onSeedConsumed?: () => void; company?: Partial<Company>; socials?: Social[] }) {
  const t = useT();
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
  // From the growth page's listing focus: narrow the seeded audience to the set of
  // families who have booked THAT listing, so counts match what the card showed.
  const restrictEmails = seedListingId
    ? new Set(bookings.filter((b) => b.listingId === seedListingId && b.email).map((b) => (b.email || "").toLowerCase()))
    : undefined;
  const restrictLabel = seedListingId ? (listings.find((l) => l.id === seedListingId)?.title || t("p8em.emThisListing")) : undefined;
  const create = async (c: { name: string; audience: Audience; template?: EmailTemplate; subject: string; html?: string; body?: string; design?: CampaignDesign; scheduledAt?: string }, action: CampStatus) => {
    setErr(null);
    const schedLabel = c.scheduledAt ? new Date(c.scheduledAt).toLocaleString(dl(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined;
    const row: Campaign = { id: `c${Date.now()}`, name: c.name, subtitle: c.template?.name ?? (c.html ? t("p8em.emDesignedEmail") : undefined), audienceName: c.audience.name, recipients: c.audience.count, status: action, statusDate: action === "scheduled" ? schedLabel : action === "sent" ? t("p8em.emJustNow") : undefined, subject: c.subject, html: c.html, body: c.body, design: c.design, scheduledAt: c.scheduledAt, recipientEmails: c.audience.emails };
    if (action !== "draft" && !c.audience.emails.length) throw new Error(t("p8em.emNobodyInAud"));
    // The send/queue is the server's; the local row keeps the design and
    // links to the server record for live status + open tracking. Errors
    // propagate to the modal so the reason is shown right where you clicked.
    if (action === "sent") {
      const r = await apiPost<{ id: string }>(withNet("/api/emails/send"), { subject: c.subject || c.name, body: c.body || c.template?.body || c.subject || c.name, html: c.html, recipients: c.audience.emails });
      row.emailId = r.id;
      onSent();
    } else if (action === "scheduled") {
      const r = await apiPost<{ id: string }>(withNet("/api/emails/schedule"), { subject: c.subject || c.name, body: c.body || c.template?.body || c.subject || c.name, html: c.html, recipients: c.audience.emails, sendAt: c.scheduledAt });
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
    if (s) return { ...c, status: s.status === "scheduled" ? "scheduled" : s.status === "sent" ? "sent" : "draft", statusDate: s.status === "cancelled" ? t("p8em.emCancelled") : whenSched(s.sendAt) };
    return c;
  });
  const knownEmailIds = new Set([
    ...campaigns.map((c) => c.emailId),
    // A fired queue doc's history id counts as covered by its campaign row.
    ...campaigns.map((c) => (c.schedId ? schedById.get(c.schedId)?.emailId : undefined)),
  ].filter(Boolean));
  const knownSchedIds = new Set(campaigns.map((c) => c.schedId).filter(Boolean));
  const serverOnly: Campaign[] = [
    ...(sched ?? []).filter((s) => s.status === "scheduled" && !knownSchedIds.has(s.id)).map((s): Campaign => ({ id: `sch-${s.id}`, schedId: s.id, name: s.subject, audienceName: t("p8em.emFrozenList"), recipients: s.recipientCount, status: "scheduled", statusDate: whenSched(s.sendAt), subject: s.subject })),
    ...(hist ?? []).filter((h) => !knownEmailIds.has(h.id)).map((h): Campaign => ({ id: `h-${h.id}`, emailId: h.id, name: h.subject, audienceName: h.audience === "one" ? t("p8em.emOneAddress") : t("p8em.emFamiliesList"), recipients: h.recipientCount, status: h.status === "sending" ? "sending" : "sent", statusDate: when(h.createdAt), subject: h.subject, delivered: h.delivered, opened: h.openedBy?.length, opens: h.delivered ? Math.round(((h.openedBy?.length ?? 0) / h.delivered) * 100) : undefined })),
  ];
  const allRows = [...linked, ...serverOnly];
  const cq = q.trim().toLowerCase();
  const rows = cq ? allRows.filter((c) => `${c.name} ${c.subtitle ?? ""} ${c.subject ?? ""} ${c.audienceName}`.toLowerCase().includes(cq)) : allRows;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-[13px] font-bold text-[var(--ink-2)]">{t("p8em.emCampaigns")}</span><div className="relative ms-2 max-w-xs flex-1"><span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8em.emSearchCampPh")} className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] py-2 ps-9 pe-8 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />{q && <button type="button" onClick={() => setQ("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--ink-3)] hover:text-[#C81E5E]">×</button>}</div><button type="button" onClick={() => setModal("campaign")} className="ms-auto rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>{t("p8em.emNewCampBtn")}</button></div>
      {err && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{err}</div>}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="grid grid-cols-[1.6fr_1.4fr_1fr_0.9fr_70px] gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><span>{t("p8em.emColCampaign")}</span><span>{t("p8em.emColAudience")}</span><span>{t("p8em.emColStatus")}</span><span>{t("p8em.emColOpens")}</span><span></span></div>
        {rows.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{cq ? t("p8em.emNoCampMatch", { q }) : t("p8em.emNoCamps")}</div>}
        {rows.map((c) => { const p = STATUS_PILL[c.status]; return (
          <div key={c.id} className="grid grid-cols-[1.6fr_1.4fr_1fr_0.9fr_70px] items-center gap-2 border-b border-[var(--line)] px-4 py-3 last:border-0">
            <div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{c.name}</div>{c.subtitle && <div className="truncate text-[12px] text-[var(--ink-3)]">{c.subtitle}</div>}</div>
            <div className="min-w-0"><div className="truncate text-[13px] text-[var(--ink-2)]">{c.audienceName}</div><div className="text-[12px] text-[var(--ink-3)]">{t("p8em.emRecipientsN", { n: c.recipients })}</div></div>
            <div><span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold" style={{ background: p.bg, color: p.fg }}>● {t("p8em.emStat_" + c.status)}</span>{c.statusDate && <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{c.statusDate}</div>}</div>
            <div>{c.opens != null ? <><div className="text-[15px] font-extrabold text-[var(--ink)]">{c.opens}%</div><div className="text-[12px] text-[var(--ink-3)]">{t("p8em.emClicksPct", { n: c.clicks ?? 0 })}</div></> : <span className="text-[var(--ink-3)]">—</span>}</div>
            <div className="text-end"><button type="button" onClick={() => setDetail(c)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.emOpenBtn")}</button></div>
          </div>
        ); })}
      </div>
      <div className="mt-3 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] px-3 py-2 text-[11.5px] text-[#1d3a8f]">{t("p8em.emCampFoot")}</div>
      {modal === "campaign" && <NewCampaign audiences={audiences} templates={templates} initialAudienceId={seedAudienceId} initialName={seedName} initialSubject={seedSubject} restrictEmails={restrictEmails} restrictLabel={restrictLabel} company={company} socials={socials} onCancel={closeCampaign} onSubmit={create} onRemovePerson={removeEnquiryPerson} />}
      {modal === "audience" && <AudienceBuilder bookings={bookings} listings={listings} locations={locations} onCancel={() => setModal("campaign")} onCreate={(a) => { setCustom((xs) => [...xs, a]); setModal("campaign"); }} />}
      {detail && <CampaignDetail c={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function CampaignDetail({ c, onClose }: { c: Campaign; onClose: () => void }) {
  const t = useT();
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
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 border-b border-[var(--line)] px-5 py-4">
          <div><div className="text-[20px] font-extrabold text-[var(--ink)]">{c.name}</div><div className="text-[12.5px] text-[var(--ink-3)]">{[c.subtitle, c.audienceName, t("p8em.emRecipientsN", { n: c.recipients })].filter(Boolean).join(" · ")}</div></div>
          <span className="ms-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold" style={{ background: p.bg, color: p.fg }}>● {t("p8em.emStat_" + c.status)}</span>
        </div>
        <div className="max-h-[66vh] overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-3"><StatCard label={t("p8em.emOpenRate")} value={tracked && delivered ? `${Math.round((opened / delivered) * 100)}%` : "—"} sub={tracked ? t("p8em.emOfN", { a: opened, b: delivered }) : undefined} tone="#16a34a" /><StatCard label={t("p8em.emDelivered")} value={tracked ? String(delivered) : "—"} sub={tracked ? t("p8em.emOfSent", { n: sent }) : undefined} tone="#16306e" /><StatCard label={t("p8em.emNotDelivered")} value={tracked ? String(bounces) : "—"} tone="#ea580c" /></div>
          <div className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emFunnel")}</div>
          <div className="mt-2">
            <FunnelBar label={t("p8em.emSentW")} n={sent} max={sent} color="#6b7280" />
            <FunnelBar label={t("p8em.emDelivered")} n={delivered} max={sent} color="#16306e" />
            <FunnelBar label={t("p8em.emOpenedW")} n={opened} max={sent} color="#16a34a" />
          </div>
          <div className="mt-3 rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">{t("p8em.emOpensNote")} {!tracked && <b>{t("p8em.emNumbersAppear")}</b>}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.cClose")}</button>
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
// Plain-English explanations for the built-in Groups (server descs are terse), keyed by the server's English segment name.
const SEG_KEYS: Record<string, string> = { "Active families": "active", "Past customers": "past", "Waitlisted": "wait", "New enquiries (no booking)": "added" };
const audTitle = (t: (k: string) => string, a: Audience) => (SEG_KEYS[a.name] ? t("p8em.emSegName_" + SEG_KEYS[a.name]) : a.name);
const audBlurb = (t: (k: string) => string, a: Audience) => (a.id === "all" ? t("p8em.emSegDesc_all") : SEG_KEYS[a.name] ? t("p8em.emSegDesc_" + SEG_KEYS[a.name]) : a.desc);
const withInput = (text: string, node: React.ReactNode) => { const [a, b] = text.split("\u0001"); return <>{a}{node}{b}</>; };
function AudienceCard({ a, onUse, extra, accent = AUD_ACCENT.segments, onRemovePerson }: { a: Audience; onUse: (a: Audience) => void; extra?: React.ReactNode; accent?: string; onRemovePerson?: (email: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pq, setPq] = useState("");
  const allPeople = a.people?.length ? a.people : a.emails.map((e) => ({ email: e, name: undefined as string | undefined }));
  const people = pq.trim() ? allPeople.filter((p) => `${p.name ?? ""} ${p.email}`.toLowerCase().includes(pq.trim().toLowerCase())) : allPeople;
  return (
    <div data-ui="card" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-2"><span className="text-[15px] font-extrabold text-[var(--ink)]">{audTitle(t, a)}</span><span className="text-[22px] font-extrabold text-[#1d3a8f]" style={{ fontVariantNumeric: "tabular-nums" }}>{a.count}</span></div>
      <p className="mt-1 text-[12px] text-[var(--ink-3)]">{audBlurb(t, a)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onUse(a)} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm" style={{ background: accent }}>{t("p8em.emUseInCampaign")}</button>
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{open ? t("p8em.emHideUp") : t("p8em.emViewN", { n: a.count })}</button>
        {extra}
      </div>
      {open && (
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
          <style>{`.aud-scroll{overflow-y:scroll}.aud-scroll::-webkit-scrollbar{width:11px}.aud-scroll::-webkit-scrollbar-track{background:#eef1f6}.aud-scroll::-webkit-scrollbar-thumb{background:#9aa9c4;border-radius:6px;border:2px solid #eef1f6}`}</style>
          <div className="border-b border-[var(--line)] bg-[var(--panel)] p-2"><input value={pq} onChange={(e) => setPq(e.target.value)} placeholder={t("p8em.emSearchRecipN", { n: allPeople.length })} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" /></div>
          <div className="aud-scroll h-52 bg-[var(--surface)]">
            {people.length === 0 ? <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">{pq.trim() ? t("p8em.emNoRecipMatch", { q: pq }) : t("p8em.emNoRecipients")}</div>
              : people.map((p) => (
                  <div key={p.email} className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 last:border-0">
                    <div className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink)]">{p.name && p.name !== p.email ? <><b className="font-semibold">{p.name}</b> · </> : null}<span className="text-[var(--ink-3)]">{p.email}</span></div>
                    {onRemovePerson && <button type="button" title={t("p8em.emRemovePersonTip")} onClick={() => { if (window.confirm(t("p8em.emRemoveOneConfirm", { email: p.email }))) onRemovePerson(p.email); }} className="flex-none text-[13px] font-bold text-[var(--ink-3)] hover:text-[#c02636]">✕</button>}
                  </div>
                ))}
          </div>
          {onRemovePerson && people.length > 0 && <button type="button" onClick={() => { if (window.confirm(t(pq.trim() ? "p8em.emRemoveShownConfirm" : "p8em.emRemoveAllConfirm", { n: people.length }))) people.forEach((p) => onRemovePerson(p.email)); }} className="w-full border-t border-[#f2c4c9] bg-[#fdf0f1] py-2.5 text-[12px] font-extrabold text-[#c02636] hover:bg-[#fbe3e5]">{t(pq.trim() ? "p8em.emRemoveShownBtn" : "p8em.emRemoveAllBtn", { n: people.length })}</button>}
        </div>
      )}
    </div>
  );
}
// The suppression list (item #45 of the backend handoff): everyone who's
// unsubscribed via the one-click link in an email footer, or been removed
// from an audience card (✕). Always excluded from marketing sends — see
// server/src/routes/emails.ts marketBlock(). Read-only: the data model has
// no "resume" flow (a genuine unsubscribe is meant to stick, per PECR), so
// this is informational only for now.
type Suppression = { id: string; email: string; at: string | null; by: string };
function SuppressionsPanel() {
  const t = useT();
  const [rows, setRows] = useState<Suppression[] | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(() => apiGet<{ suppressions: Suppression[] }>(withNet("/api/emails/suppressions")).then((d) => setRows(d.suppressions)).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  useRealtime(["emailSuppressions"], load);
  const ql = q.trim().toLowerCase();
  const shown = rows ? (ql ? rows.filter((r) => r.email.toLowerCase().includes(ql)) : rows) : null;
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString(dl(), { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <div>
      <div className="mb-3 rounded-lg border-s-4 border-[#c78a00] bg-[#fff8e8] px-3 py-2 text-[11.5px] text-[#7a5600]"><RichB text={t("p8em.emSuppNote")} /></div>
      <div className="relative mb-3 max-w-sm"><span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8em.emSearchSuppPh")} className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] py-2 ps-9 pe-8 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />{q && <button type="button" onClick={() => setQ("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--ink-3)] hover:text-[#C81E5E]">×</button>}</div>
      {shown === null
        ? <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8em.cLoading")}</div>
        : shown.length === 0
        ? <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-5 text-center text-[12.5px] text-[var(--ink-3)]">{ql ? t("p8em.emNoSuppMatch", { q }) : t("p8em.emNobodyUnsub")}</div>
        : <div className="flex flex-col gap-2">{shown.map((r) => (
            <div key={r.id} data-ui="card" className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[var(--ink)]">{r.email}</div>
              <Badge tone={r.by === "operator" ? { bg: "var(--panel)", fg: "var(--ink-2)" } : { bg: "#fdebec", fg: "#c02636" }}>{r.by === "operator" ? t("p8em.emRemovedByOp") : t("p8em.emUnsubscribed")}</Badge>
              <span className="flex-none text-[11.5px] text-[var(--ink-3)]">{fmt(r.at)}</span>
            </div>
          ))}</div>}
    </div>
  );
}

function AudiencesView({ onUse, payMethods = [], seasons = [] }: { onUse: (a: Audience) => void; payMethods?: string[]; seasons?: Season[] }) {
  const { t, locale } = useI18n();
  const { bookings, listings, locations, allAudience, liveSegments } = useCampaignData();
  const [enquiries, setEnquiries] = useState<EnquiryRec[]>(() => readLS<EnquiryRec[]>(LS_ENQ, []));
  useEffect(() => { writeLS(LS_ENQ, enquiries); }, [enquiries]);
  const removeEnquiryPerson = (email: string) => setEnquiries((xs) => xs.filter((e) => (e.email || "").toLowerCase() !== email.toLowerCase()));
  // Removing a server-side family (added under New Family / synced) means
  // suppressing them from marketing — reversible, leaves the record intact.
  const [suppressed, setSuppressed] = useState<Set<string>>(() => new Set());
  const suppressPerson = (email: string) => { const e = email.toLowerCase(); setSuppressed((s) => { const n = new Set(s); n.add(e); return n; }); apiPost("/api/emails/suppress", { email: e }).catch(() => {}); };
  // The merged "Not booked yet" card spans both sources, so removing spans both.
  const removeFromNotBooked = (email: string) => { removeEnquiryPerson(email); suppressPerson(email); };
  const [period, setPeriod] = useState<"30" | "90" | "all">("all");
  const [nowMs] = useState(() => Date.now());
  const [sub, setSub] = useState<"segments" | "enquiries" | "suppressed">("enquiries");
  const [suppressedCount, setSuppressedCount] = useState<number | null>(null);
  const loadSuppressedCount = useCallback(() => apiGet<{ count: number }>(withNet("/api/emails/suppressions")).then((d) => setSuppressedCount(d.count)).catch(() => {}), []);
  useEffect(() => { loadSuppressedCount(); }, [loadSuppressedCount]);
  useRealtime(["emailSuppressions"], loadSuppressedCount);
  const [q, setQ] = useState("");
  const [enqLoc, setEnqLoc] = useState("all");
  const [segLoc, setSegLoc] = useState("");
  const [segListing, setSegListing] = useState("");
  const [segPay, setSegPay] = useState("");
  const [segSeason, setSegSeason] = useState("");
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
    if (id === "g-new") return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink-2)]">{withInput(t("p8em.emPerLast", { n: "\u0001" }), numBox(newDays, setNewDays, 7, 365))}</span>;
    if (id === "g-ending") return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink-2)]">{withInput(t("p8em.emPerNext", { n: "\u0001" }), numBox(endDays, setEndDays, 1, 90))}</span>;
    if (id === "g-lapsed") return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink-2)]">{withInput(t("p8em.emPerMonths", { n: "\u0001" }), numBox(lapsedMonths, setLapsedMonths, 1, 36))}</span>;
    return null;
  };
  const cutoff = period === "all" ? 0 : nowMs - Number(period) * 86_400_000;
  const enqInPeriod = enquiries.filter((e) => period === "all" || !e.at || Date.parse(e.at) >= cutoff);
  const enquiryAuds = computeEnquiryAudiences(enqInPeriod, bookings);
  // Hide server segments that duplicate the lead card (active families) or the Enquiries tab (never-booked).
  // Only hide the server "Active families" (the lead 'All active families' card already covers it).
  // "New enquiries (no booking)" stays — that's how families you add in New Family (not yet booked) surface.
  // Booked parents = only families with bookings. Non-booked people (added via New
  // Family, or marked from the inbox) belong in Enquiries, so hide them from Groups.
  const HIDDEN_SEGS = new Set(["Active families", "All active families", "New enquiries (no booking)", "New enquiries"]);
  const groupSegs = liveSegments.filter((s) => !HIDDEN_SEGS.has(s.name));
  // The server "added but not booked" segment (New Family / sign-ups) — shown under Enquiries.
  const addedNotBooked = liveSegments.find((s) => s.name === "New enquiries (no booking)");
  // Both "added under New Family" (server) and "emailed & marked as an enquiry"
  // (inbox) describe the same thing: someone interested who hasn't booked. Merge
  // them into ONE card, deduped by email (prefer the entry that carries a name),
  // so operators don't see two near-identical "all" lists.
  const combinedNotBooked: Audience | null = (() => {
    const parts = [addedNotBooked, enquiryAuds[0]].filter(Boolean) as Audience[];
    if (!parts.length) return null;
    const map = new Map<string, { email: string; name?: string }>();
    for (const seg of parts) {
      const ppl = seg.people?.length ? seg.people : seg.emails.map((e) => ({ email: e, name: undefined as string | undefined }));
      for (const p of ppl) {
        const k = p.email.toLowerCase();
        if (suppressed.has(k)) continue;
        const ex = map.get(k);
        if (!ex || (!ex.name && p.name)) map.set(k, { email: p.email, name: p.name ?? ex?.name });
      }
    }
    const people = [...map.values()];
    return { id: "enq-all", name: t("p8em.emEnqEveryoneName"), desc: t("p8em.emEnqEveryoneDesc"), count: people.length, emails: people.map((p) => p.email), people };
  })();
  // Break the "everyone" total down by location — a true PARTITION, so the
  // per-location cards always sum back to the headline total. Each person lands
  // in exactly one bucket: their (first) enquiry location, else "No location"
  // (which is where added-under-New-Family families with no location sit).
  const enqLocOf = new Map<string, string>();
  for (const e of enqInPeriod) { const em = e.email?.toLowerCase(); if (em && !enqLocOf.has(em)) enqLocOf.set(em, e.location || "No location"); }
  const enqBreakdown: Audience[] = (() => {
    if (!combinedNotBooked?.people?.length) return [];
    const buckets = new Map<string, { email: string; name?: string }[]>();
    for (const p of combinedNotBooked.people) { const loc = enqLocOf.get(p.email.toLowerCase()) || "No location"; (buckets.get(loc) ?? buckets.set(loc, []).get(loc)!).push(p); }
    return [...buckets].map(([loc, ppl]) => ({ id: `enq-${loc}`, name: t("p8em.emEnqAudLoc", { loc: loc === "No location" ? t("p8em.emNoLocation") : loc }), count: ppl.length, emails: ppl.map((x) => x.email), people: ppl, desc: loc === "No location" ? t("p8em.emEnqNoLocDesc") : t("p8em.emEnqDescLoc", { loc }) }));
  })();
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
    mkGroup("g-new", t("p8em.emGrp_new_name"), t("p8em.emGrp_new_desc", { n: newDays }), (a) => a.first !== Infinity && a.first >= nowMs - newDays * DAY),
    mkGroup("g-repeat", t("p8em.emGrp_repeat_name"), t("p8em.emGrp_repeat_desc"), (a) => a.count >= 2),
    mkGroup("g-multi", t("p8em.emGrp_multi_name"), t("p8em.emGrp_multi_desc"), (a) => a.children.size >= 2),
    mkGroup("g-ending", t("p8em.emGrp_ending_name"), t("p8em.emGrp_ending_desc", { n: endDays }), (a) => a.last > 0 && a.futureAt >= nowMs && a.futureAt <= soonEnd),
    mkGroup("g-lapsed", t("p8em.emGrp_lapsed_name"), t("p8em.emGrp_lapsed_desc", { n: lapsedMonths }), (a) => a.last > 0 && a.last < nowMs - lapsedMonths * 30 * DAY && !a.future),
  ];
  const hasPayData = bookings.some((b) => !!b.method);
  // Belt and braces: if a value is somehow still held (bookings reloaded without
  // methods, a restored form), it must not quietly filter everyone out.
  const payFilter = hasPayData ? segPay : "";
  const SUBS = [
    { k: "enquiries" as const, label: t("p8em.emSubEnquiries"), count: combinedNotBooked?.count ?? 0 },
    { k: "segments" as const, label: t("p8em.emSubBooked"), count: 1 + computedGroups.length + groupSegs.length },
    { k: "suppressed" as const, label: t("p8em.emSubUnsub"), count: suppressedCount ?? 0 },
  ];
  // Groups tab: build a live family group from the location + listing + season
  // filters (all preset to "All"). A season is just a session-date window, so it
  // reuses the existing from/to/dateType machinery.
  const season = seasons.find((s) => s.id === segSeason);
  const segFiltered = !!(segLoc || segListing || payFilter || season);
  const segTitle = listings.find((l) => l.id === segListing)?.title;
  // A season is the set of listings tagged to it (in the listing builder), so
  // filtering by season = filtering by those listing ids. A specific listing
  // pick still wins. A season with no listings yet → a sentinel that matches
  // nobody (rather than falling through to "everyone").
  const seasonListings = season ? listings.filter((l) => l.seasonId === season.id).map((l) => l.id) : [];
  const seasonListingFilter = season ? (seasonListings.length ? seasonListings : ["__none__"]) : undefined;
  const segFilterObj: AudFilter = { location: segLoc || undefined, listingIds: segListing ? [segListing] : seasonListingFilter, paymentMethod: payFilter || undefined };
  const segResolved = segFiltered ? resolveAudience(bookings, segFilterObj) : { emails: allAudience.emails, count: allAudience.count };
  const filteredAudience: Audience = segFiltered
    ? { id: "seg-filter", name: `${t("p8em.emFamilies")}${segLoc ? ` · ${segLoc}` : ""}${segTitle ? ` · ${segTitle}` : ""}${season && !segListing ? ` · ${season.name}` : ""}${segPay ? ` · ${segPay}` : ""}`, count: segResolved.count, emails: segResolved.emails, desc: `${season && !segListing ? t("p8em.emFiltDescSeason", { name: season.name }) : t("p8em.emFiltDescActive")}${segLoc ? t("p8em.emFiltIn", { loc: segLoc }) : ""}${segTitle ? t("p8em.emFiltOn", { title: segTitle }) : ""}${segPay ? t("p8em.emFiltPaid", { pay: segPay }) : ""}`, filter: segFilterObj, people: segResolved.emails.map((e) => ({ email: e })) }
    : allAudience;
  return (
    <div>
      <div className="mb-3 rounded-lg border-s-4 border-[#2f6bd8] bg-[#eef4fd] px-3 py-2 text-[12px] text-[#1d3a8f]"><RichB text={t("p8em.emAudInfo")} /></div>
      <div className="relative mb-3 max-w-sm"><span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8em.emSearchAudPh")} className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] py-2 ps-9 pe-8 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />{q && <button type="button" onClick={() => setQ("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--ink-3)] hover:text-[#C81E5E]">×</button>}</div>

      {/* switch between the three audience areas */}
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1">
        {SUBS.map((s) => <button key={s.k} type="button" onClick={() => setSub(s.k)} className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-extrabold transition ${sub === s.k ? "bg-[var(--surface)] text-[#2f5fd0] shadow-sm" : "text-[var(--ink-2)] hover:text-[#2f5fd0]"}`}>{s.label}<span className={`rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums ${sub === s.k ? "bg-[#E8EEFD] text-[#2f5fd0]" : "bg-[var(--line)] text-[var(--ink-3)]"}`}>{s.count}</span></button>)}
      </div>

      {sub === "segments" && (<>
        <AudSection title={t("p8em.emGrpGroups")} hint={t("p8em.emGroupsHint")} />
        <div className="mb-4 rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm">
          <div className="mb-3 text-[14px] font-extrabold text-[#16306e]">{seasons.length ? t("p8em.emNarrowBySeason") : t("p8em.emNarrowBy")}</div>
          <div className={`grid gap-3 sm:grid-cols-2 ${seasons.length ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {seasons.length > 0 && <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emFSeason")}</div><select value={segSeason} onChange={(e) => setSegSeason(e.target.value)} className="w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-[15px] font-semibold text-[var(--ink)] outline-none focus:border-[#2f5fd0]"><option value="">{t("p8em.emAllSeasons")}</option>{seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
            <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emFLocation")}</div><select value={segLoc} onChange={(e) => setSegLoc(e.target.value)} className="w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-[15px] font-semibold text-[var(--ink)] outline-none focus:border-[#2f5fd0]"><option value="">{t("p8em.emAllLocations")}</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
            <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emFListing")}</div><select value={segListing} onChange={(e) => setSegListing(e.target.value)} className="w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-[15px] font-semibold text-[var(--ink)] outline-none focus:border-[#2f5fd0]"><option value="">{t("p8em.emAllListings")}</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></div>
            {/* DISABLED until bookings actually carry a payment method. It used
                to stay pickable with only a note underneath: choosing "Card"
                matched nothing, the audience silently fell to 0, and you could
                send a campaign to an empty list believing it went out. A filter
                that cannot match must not be selectable. */}
            <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emFPayment")}</div><select value={segPay} onChange={(e) => setSegPay(e.target.value)} disabled={!hasPayData} title={hasPayData ? undefined : t("p8em.emPayNA")} className="w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-[15px] font-semibold text-[var(--ink)] outline-none focus:border-[#2f5fd0] disabled:cursor-not-allowed disabled:bg-[var(--panel)] disabled:text-[var(--ink-3)]"><option value="">{t("p8em.emAnyMethod")}</option>{payMethods.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          </div>
          {!hasPayData && <p className="mt-2 text-[11px] text-[#9a6b00]"><RichB text={t("p8em.emPayWarn")} /></p>}
          {segFiltered && <div className="mt-3 flex items-center gap-2"><span className="rounded-lg bg-[#eef4fd] px-3 py-1.5 text-[13px] font-extrabold text-[#1d3a8f]">{pickPlural(t, locale, "p8em.emMatchFam", filteredAudience.count)}</span><button type="button" onClick={() => { setSegLoc(""); setSegListing(""); setSegPay(""); setSegSeason(""); }} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[#c02636]">{t("p8em.emClearFilters")}</button></div>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[filteredAudience, ...computedGroups, ...groupSegs].filter(matchAud).map((a) => <AudienceCard key={a.id} a={a} onUse={onUse} accent={AUD_ACCENT.segments} extra={periodEditor(a.id)} />)}</div>
      </>)}

      {sub === "enquiries" && (<>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AudSection title={t("p8em.emEnqTitleH")} hint={t("p8em.emEnqHint")} />
          <div className="flex flex-wrap items-center gap-2">
            <select value={enqLoc} onChange={(e) => setEnqLoc(e.target.value)} title={t("p8em.emEnqFilterTip")} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)]"><option value="all">{t("p8em.emEnqAllLoc")}</option>{enqBreakdown.map((a) => { const loc = a.id.slice(4); return <option key={a.id} value={loc}>{loc === "No location" ? t("p8em.emNoLocation") : loc} ({a.count})</option>; })}</select>
            <span className="text-[11.5px] font-bold text-[var(--ink-3)]">{t("p8em.emEnqWithin")}</span><div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)] text-[12px] font-bold">{(["30", "90", "all"] as const).map((v) => <button key={v} type="button" title={t("p8em.emPerTip_" + v)} onClick={() => setPeriod(v)} className="px-3 py-1" style={period === v ? { background: "#eef4fd", color: "#1d3a8f" } : { color: "var(--ink-2)" }}>{t("p8em.emPer_" + v)}</button>)}</div>
          </div>
        </div>
        <p className="mb-2 mt-1 text-[11.5px] text-[var(--ink-3)]"><RichB text={t("p8em.emEnqPeriodNote")} /></p>
        <div className="mb-3 rounded-lg border-s-4 border-[#c78a00] bg-[#fff8e8] px-3 py-2 text-[11.5px] text-[#7a5600]"><RichB text={t("p8em.emPecr")} /></div>
        {!combinedNotBooked?.count
          ? <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-5 text-center text-[12.5px] text-[var(--ink-3)]"><RichB text={t("p8em.emNoOpenEnq")} /></div>
          : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {enqLoc === "all" && combinedNotBooked && matchAud(combinedNotBooked) && <AudienceCard key="notbooked" a={combinedNotBooked} onUse={onUse} accent={AUD_ACCENT.enquiries} onRemovePerson={removeFromNotBooked} />}
              {(enqLoc === "all" ? enqBreakdown : enqBreakdown.filter((a) => a.id.slice(4) === enqLoc)).filter(matchAud).map((a) => <AudienceCard key={a.id} a={a} onUse={onUse} accent={AUD_ACCENT.enquiries} onRemovePerson={removeFromNotBooked} />)}
            </div>}
      </>)}

      {sub === "suppressed" && <SuppressionsPanel />}

    </div>
  );
}

interface EmailTemplate { id: string; name: string; subject?: string; body: string }
function TemplatesView({ onUse, company, socials }: { onUse: (tp: EmailTemplate) => void; company?: Partial<Company>; socials?: Social[] }) {
  const t = useT();
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
    // Prompt OUTSIDE the updater — React double-invokes updaters in dev
    // (StrictMode), which showed the prompt twice and kept the second
    // (auto-dismissed) answer.
    const nm = designer?.mode === "edit" ? null : (window.prompt(t("p8em.emDesignNamePrompt"), t("p8em.emMyDesign")) || t("p8em.emMyDesign"));
    setDesigns((xs) => {
      let next: SavedTemplate[];
      if (designer?.mode === "edit") next = xs.map((x) => (x.id === designer.item.id ? { ...x, accent: d.accent, blocks: d.blocks } : x));
      else next = [{ id: `td-${dNow}-${xs.length}`, name: (nm ?? t("p8em.emMyDesign")).trim() || t("p8em.emMyDesign"), accent: d.accent, blocks: d.blocks }, ...xs];
      persistMyTemplates(next); return next;
    });
    setDesigner(null);
  };
  const delDesign = (item: SavedTemplate) => { if (!confirm(t("p8em.emDeleteDesignConfirm", { name: item.name }))) return; setDesigns((xs) => { const next = xs.filter((x) => x.id !== item.id); persistMyTemplates(next); return next; }); };
  const load = useCallback(() => apiGet<EmailTemplate[]>("/api/messages/templates").then(setTemplates).catch(() => setTemplates([])), []);
  useEffect(() => { load(); }, [load]);
  async function saveTmpl() {
    if (!edit || !edit.name.trim()) { setErr(t("p8em.emGiveName")); return; }
    setBusy(true); setErr(null);
    const payload = { name: edit.name.trim(), subject: edit.subject?.trim() || undefined, body: edit.body };
    try {
      if (edit.id) await api(`/api/messages/templates/${encodeURIComponent(edit.id)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiPost("/api/messages/templates", payload);
      setEdit(null); load();
    } catch (e) { setErr(e instanceof Error ? e.message : t("p8em.nfCouldntSave")); }
    finally { setBusy(false); }
  }
  async function del(tp: EmailTemplate) {
    if (!confirm(t("p8em.emDeleteTplConfirm", { name: tp.name }))) return;
    try { await api(`/api/messages/templates/${encodeURIComponent(tp.id)}`, { method: "DELETE" }); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : t("p8em.cDeleteFailed")); }
  }
  if (!templates) return <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8em.cLoading")}</div>;
  const tq = q.trim().toLowerCase();
  const wShown = tq ? templates.filter((tp) => `${tp.name} ${tp.subject ?? ""} ${tp.body}`.toLowerCase().includes(tq)) : templates;
  const dShown = tq ? designs.filter((s) => s.name.toLowerCase().includes(tq)) : designs;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[13px] font-bold shadow-sm">
          {([["worded", t("p8em.emTabWorded")], ["designed", `${t("p8em.emTabBuilder")}${designs.length ? ` (${designs.length})` : ""}`]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setSub(k)} className="px-4 py-2.5" style={sub === k ? { background: "#eef4fd", color: "#1d3a8f" } : { color: "var(--ink-2)" }}>{l}</button>)}
        </div>
        <div className="relative max-w-xs flex-1"><span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8em.emSearchTplPh")} className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] py-2 ps-9 pe-8 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />{q && <button type="button" onClick={() => setQ("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--ink-3)] hover:text-[#C81E5E]">×</button>}</div>
      </div>
      {err && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{err}</div>}

      {sub === "worded" && <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-bold text-[var(--ink-2)]">{t("p8em.emReusableWorded")}</span>
        <button type="button" onClick={() => setEdit({ id: "", name: "", subject: "", body: "" })} className="rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{t("p8em.emNewTplBtn")}</button>
      </div>
      {wShown.length === 0 ? <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">{tq ? t("p8em.emNoWordedMatch", { q }) : t("p8em.emNoTemplates")}</Card>
      : <div className="flex flex-col gap-2">{wShown.map((tp) => (
          <div key={tp.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-bold text-[var(--ink)]">{tp.name}</div>{tp.subject && <div className="truncate text-[12px] text-[var(--ink-3)]">{tp.subject}</div>}</div>
            <button type="button" onClick={() => onUse(tp)} className="flex-none rounded-lg border border-[#2f6bd8] px-3 py-1.5 text-[12px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">{t("p8em.emUse")}</button>
            <button type="button" onClick={() => setEdit(tp)} className="flex-none rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.cEdit")}</button>
            <button type="button" onClick={() => del(tp)} className="flex-none rounded-lg border border-[#f6c9cc] px-3 py-1.5 text-[12px] font-bold text-[#c02636] hover:bg-[#fdebec]">{t("p8em.cDelete")}</button>
          </div>
        ))}</div>}
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">{t("p8em.emMergeTip")}</p>
      </>}

      {sub === "designed" && <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-bold text-[var(--ink-2)]">{t("p8em.emBuildSave")}</span>
        <button type="button" onClick={() => setDesigner({ mode: "new" })} className="rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>{t("p8em.emNewBuilderTpl")}</button>
      </div>
      {dShown.length === 0
        ? <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">{tq ? t("p8em.emNoBuilderMatch", { q }) : <RichB text={t("p8em.emNoDesigns")} />}</Card>
        : <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>{dShown.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              <div className="h-44 w-full overflow-hidden border-b border-[var(--line)] bg-[var(--surface)]"><div style={{ width: 640, transform: "scale(0.375)", transformOrigin: "top left", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: renderDesignHtml({ accent: s.accent, blocks: s.blocks }, company, dNow) }} /></div>
              <div className="flex items-center gap-2 p-2.5"><div className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-[var(--ink)]">{s.name}</div><button type="button" onClick={() => setDesigner({ mode: "edit", item: s })} className="flex-none rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.cEdit")}</button><button type="button" onClick={() => delDesign(s)} className="flex-none rounded-lg border border-[#f6c9cc] px-2.5 py-1 text-[11.5px] font-bold text-[#c02636] hover:bg-[#fdebec]">{t("p8em.cDelete")}</button></div>
            </div>
          ))}</div>}
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]"><RichB text={t("p8em.emBuilderNote")} /></p>
      </>}
      {/* No wrapping div here: CampaignDesigner's own root is already
          position:fixed, so a positioned "relative z-[130]" wrapper around
          it did nothing for layout but everything for harm — it created a
          NEW stacking context that trapped the designer's own z-index
          inside it, so raising the designer's z-index could never beat the
          app header (z-[300], a true sibling-level stacking context) no
          matter how high — the outer z-130 wrapper was what actually got
          compared against the header, not the designer's inner z-index.
          Confirmed live via getComputedStyle + elementFromPoint. */}
      {designer && <CampaignDesigner initial={designer.mode === "edit" ? { accent: designer.item.accent, blocks: designer.item.blocks } : null} company={company} socials={socials} onCancel={() => setDesigner(null)} onSave={saveDesign} saveLabel={t("p8em.emSaveTplLabel")} />}

      {edit && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={() => setEdit(null)}>
          <div className="w-full max-w-xl rounded-2xl bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center border-b border-[var(--line)] px-5 py-3.5"><div className="text-[17px] font-extrabold text-[var(--ink)]">{edit.id ? t("p8em.tplEdit") : t("p8em.tplNew")}</div><button type="button" onClick={() => setEdit(null)} className="ms-auto flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[var(--ink-3)] hover:bg-[var(--panel)]">×</button></div>
            <div className="max-h-[66vh] space-y-2.5 overflow-y-auto p-5">
              <div><FieldLabel>{t("p8em.cName")}</FieldLabel><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={t("p8em.tplNamePh")} className="w-full" /></div>
              <div><FieldLabel>{t("p8em.emSubjectOptional")}</FieldLabel><Input value={edit.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} placeholder={t("p8em.emSubjectLine")} className="w-full" /></div>
              <div><FieldLabel>{t("p8em.emBodyLbl")}</FieldLabel><textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={8} placeholder={t("p8em.emTplBodyPh")} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]" /><div className="mt-1 flex flex-wrap gap-1.5">{MERGE_FIELDS.map((f) => <button key={f.token} type="button" title={t("p8em.mf_" + f.token.replace(/[{}]/g, ""))} onClick={() => setEdit((d) => d && ({ ...d, body: `${d.body}${d.body && !d.body.endsWith(" ") ? " " : ""}${f.token}` }))} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{f.token}</button>)}</div></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-3"><button type="button" onClick={() => setEdit(null)} className="rounded-lg border border-[var(--line)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">{t("p8em.cCancel")}</button><button type="button" onClick={saveTmpl} disabled={busy} className="rounded-lg px-3.5 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-50" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{busy ? t("p8em.cSaving") : t("p8em.emSaveTpl")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsView() {
  const { t, locale } = useI18n();
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
      <div className="mb-3 rounded-lg border-s-4 border-[#2f6bd8] bg-[#eef4fd] px-3 py-2 text-[12px] text-[#1d3a8f]"><RichB text={t("p8em.emAnInfo")} /></div>
      {/* campaign selector */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emColCampaign")}</span>
        <Select value={sel} onChange={(e) => setSel(e.target.value)} className="max-w-[340px] font-bold text-[#1d3a8f]">
          <option value="all">{t("p8em.emAllSends", { n: rows.length })}</option>
          {rows.map((c) => <option key={c.id} value={c.id}>{c.subject} — {when(c.createdAt)}</option>)}
        </Select>
      </div>
      {active && <div className="mb-3 flex items-baseline gap-2"><span className="text-[16px] font-extrabold text-[var(--ink)]">{active.subject}</span><span className="ms-auto text-[12px] text-[var(--ink-3)]">{when(active.createdAt)}</span></div>}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label={t("p8em.emSentW")} value={String(sent)} sub={t("p8em.emSendsN", { n: base.length })} />
        <StatCard label={t("p8em.emDelivered")} value={String(delivered)} sub={sent ? t("p8em.emPctOfSent", { n: Math.round((delivered / sent) * 100) }) : undefined} />
        <StatCard label={t("p8em.emOpenRate")} value={`${openRate}%`} sub={t("p8em.emNOpened", { n: opened })} tone="#16a34a" />
        <StatCard label={t("p8em.emNotDelivered")} value={String(bounces)} sub={sent ? `${Math.round((bounces / sent) * 100)}%` : undefined} tone="#ea580c" />
        <StatCard label={t("p8em.emClickRate")} value="—" sub={t("p8em.emLinkTrackSoon")} />
      </div>
      {active
        ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="mb-3 text-[15px] font-extrabold text-[var(--ink)]">{t("p8em.emFunnel")}</div>
            <div className="space-y-2.5">
              <FunnelBar label={t("p8em.emSentW")} n={sent} max={sent} color="#6b7280" />
              <FunnelBar label={t("p8em.emDelivered")} n={delivered} max={sent} color="#16306e" />
              <FunnelBar label={t("p8em.emOpenedW")} n={opened} max={sent} color="#16a34a" />
            </div>
          </div>
        : <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="mb-3 text-[15px] font-extrabold text-[var(--ink)]">{t("p8em.emOpenRateBySend")} <span className="text-[12px] font-normal text-[var(--ink-3)]">{t("p8em.emTapBreakdown")}</span></div>
            {rows.length === 0 ? <div className="py-4 text-center text-[13px] text-[var(--ink-3)]">{t("p8em.emNoSends")}</div>
            : rows.filter((c) => c.deliveredN > 0).slice(0, 10).map((c) => { const pct = Math.round((c.openedN / c.deliveredN) * 100); return (
              <button key={c.id} type="button" onClick={() => setSel(c.id)} className="mb-3 block w-full text-start last:mb-0"><div className="flex justify-between text-[13px]"><span className="truncate pe-3 text-[var(--ink-2)] hover:text-[#1d3a8f]">{c.subject}</span><span className="flex-none font-bold text-[var(--ink)]">{t("p8em.emPctOpen", { n: pct })}</span></div><div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#16306e" }} /></div></button>
            ); })}
          </div>}
    </div>
  );
}

interface EmailSig { id: string; name: string; html: string }
function SignatureManager({ settings, save, onClose }: { settings: TenantSettings; save: (patch: { settings?: TenantSettings }) => Promise<void>; onClose: () => void }) {
  const t = useT();
  const sigs: EmailSig[] = settings.emailSignatures ?? [];
  const seq = useRef(0);
  const [draft, setDraft] = useState<EmailSig | null>(null);
  const b = settings.billing ?? {};
  const name = settings.providerName || b.businessName || t("p8em.emYourBusiness");
  const fromDetails = () => `${b.logoUrl ? `<img src="${b.logoUrl}" alt="" style="max-height:64px"><br>` : ""}<b>${name}</b><br>${b.phone ? `${t("p8em.emSigTel", { v: b.phone })}<br>` : ""}${b.email ? t("p8em.emSigEmail", { v: b.email }) : ""}`;
  const persist = (next: EmailSig[], def?: string) => save({ settings: { ...settings, emailSignatures: next, ...(def !== undefined ? { defaultSignatureId: def } : {}) } });
  const saveDraft = () => { if (!draft) return; const d = { ...draft, name: draft.name.trim() || t("p8em.emSigDefName") }; persist(sigs.some((s) => s.id === d.id) ? sigs.map((s) => s.id === d.id ? d : s) : [...sigs, d]); setDraft(null); };
  const del = (id: string) => { if (confirm(t("p8em.emSigDeleteConfirm"))) persist(sigs.filter((s) => s.id !== id), settings.defaultSignatureId === id ? "" : undefined); };
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-[var(--line)] px-5 py-3.5"><div className="text-[17px] font-extrabold text-[var(--ink)]">{t("p8em.emManageSigs")}</div><button type="button" onClick={onClose} className="ms-auto flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[var(--ink-3)] hover:bg-[var(--panel)]">×</button></div>
        <div className="max-h-[66vh] overflow-y-auto p-5">
          {!draft ? (
            <>
              {sigs.length === 0 ? <p className="mb-3 text-[13px] text-[var(--ink-3)]">{t("p8em.emNoSigs")}</p>
              : <div className="mb-3 flex flex-col gap-2">{sigs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-3">
                    <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold text-[var(--ink)]">{s.name}{settings.defaultSignatureId === s.id && <span className="ms-2 rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-extrabold text-[#1d3a8f]">{t("p8em.emDefault")}</span>}</div><div className="mt-1 max-h-16 overflow-hidden text-[11.5px] text-[var(--ink-3)]" dangerouslySetInnerHTML={{ __html: s.html }} /></div>
                    <div className="flex flex-none flex-col gap-1">
                      <button type="button" onClick={() => setDraft(s)} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.cEdit")}</button>
                      <button type="button" onClick={() => persist(sigs, settings.defaultSignatureId === s.id ? "" : s.id)} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{settings.defaultSignatureId === s.id ? t("p8em.emUnsetDefault") : t("p8em.emDefault")}</button>
                      <button type="button" onClick={() => del(s.id)} className="rounded-md border border-[#f6c9cc] px-2 py-0.5 text-[11px] font-bold text-[#c02636] hover:bg-[#fdebec]">{t("p8em.cDelete")}</button>
                    </div>
                  </div>
                ))}</div>}
              <button type="button" onClick={() => setDraft({ id: `sig-${sigs.length}-${seq.current++}`, name: "", html: fromDetails() })} className="rounded-lg px-3.5 py-2 text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>{t("p8em.emNewSig")}</button>
            </>
          ) : (
            <div className="space-y-2.5">
              <div><FieldLabel>{t("p8em.cName")}</FieldLabel><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("p8em.emSigNamePh")} className="w-full" /></div>
              <div className="flex flex-wrap gap-2">
                {b.logoUrl && <button type="button" onClick={() => setDraft((d) => d && ({ ...d, html: `${d.html}<img src="${b.logoUrl}" alt="" style="max-height:64px"><br>` }))} className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.emInsertLogo")}</button>}
                <button type="button" onClick={() => setDraft((d) => d && ({ ...d, html: fromDetails() }))} className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.emFillFromBiz")}</button>
              </div>
              <div><FieldLabel>{t("p8em.emSignature")}</FieldLabel><RichText value={draft.html} onChange={(h) => setDraft((d) => d && ({ ...d, html: h }))} /></div>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-[var(--line)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">{t("p8em.cCancel")}</button><button type="button" onClick={saveDraft} className="rounded-lg px-3.5 py-1.5 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>{t("p8em.emSaveSig")}</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailPrefs({ settings, save }: { settings: TenantSettings; save: (patch: { settings?: TenantSettings }) => Promise<void> }) {
  const t = useT();
  const p = settings.emailPrefs ?? {};
  const sigs = settings.emailSignatures ?? [];
  const setP = (patch: Partial<NonNullable<TenantSettings["emailPrefs"]>>) => save({ settings: { ...settings, emailPrefs: { ...p, ...patch } } });
  const chip = (on: boolean) => on ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" };
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <MailboxSetup context="settings" />
      <Card className="p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8em.emUndoSend")}</div>
        <p className="mb-2 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8em.emUndoSendSub")}</p>
        <div className="flex flex-wrap gap-1.5">{([[0, t("p8em.emOff")], [5, "5s"], [10, "10s"], [20, "20s"], [30, "30s"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setP({ undoSeconds: v })} className="rounded-full border px-3 py-1 text-[12.5px] font-bold" style={chip((p.undoSeconds ?? 5) === v)}>{l}</button>)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8em.emSigDefaults")}</div>
        <p className="mb-2 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8em.emSigDefaultsSub")}</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div><FieldLabel>{t("p8em.emOnNewEmails")}</FieldLabel><Select value={settings.defaultSignatureId || "none"} onChange={(e) => save({ settings: { ...settings, defaultSignatureId: e.target.value === "none" ? "" : e.target.value } })} className="w-full"><option value="none">{t("p8em.emNoSignature")}</option>{sigs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <div><FieldLabel>{t("p8em.emOnReplyFwd")}</FieldLabel><Select value={p.replySignatureId || "none"} onChange={(e) => setP({ replySignatureId: e.target.value === "none" ? "" : e.target.value })} className="w-full"><option value="none">{t("p8em.emNoSignature")}</option>{sigs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8em.emDefReply")}</div>
        <p className="mb-2 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8em.emDefReplySub")}</p>
        <div className="flex flex-wrap gap-1.5">{([["reply", t("p8em.emReplyPlain")], ["replyAll", t("p8em.emReplyAllPlain")]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setP({ defaultReply: v })} className="rounded-full border px-3 py-1 text-[12.5px] font-bold" style={chip((p.defaultReply ?? "reply") === v)}>{l}</button>)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8em.emSocial")}</div>
        <p className="mb-2.5 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8em.emSocialSub")}</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {([["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["twitter", "X / Twitter"], ["youtube", "YouTube"], ["website", t("p8em.emWebsite")]] as const).map(([net, label]) => (
            <div key={net}><FieldLabel>{label}</FieldLabel><Input value={(settings.social?.[net] as string) ?? ""} onChange={(e) => save({ settings: { ...settings, social: { ...settings.social, [net]: e.target.value } } })} placeholder={net === "website" ? "https://…" : t("p8em.emProfileUrl")} className="w-full" /></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Growth-page goals → a ready-made campaign name + subject line, so a play lands
// in the composer with sensible content already written (the operator edits from there).
const GOAL_SEED: Record<string, { name: string; subject: string }> = {
  winback: { name: "Win-back offer", subject: "We’ve missed you — here’s a little something to come back" },
  fill: { name: "Fill the last spaces", subject: "A few spaces left — grab one before they’re gone" },
  review: { name: "Review request", subject: "How did we do? A quick favour" },
  membership: { name: "Membership offer", subject: "Save on every booking with membership" },
  newsletter: { name: "Newsletter", subject: "What’s on with us" },
  midweek: { name: "Midweek offer", subject: "A midweek treat — a little off your next booking" },
};

export function EmailApp() {
  const { t, locale } = useI18n();
  // Deep-link from the Register: ?to=parent@email opens addressed to one parent.
  const searchParams = useSearchParams();
  const presetTo = searchParams.get("to") ?? "";
  // Deep-link from the growth page ("Grow your numbers"): ?aud=<segment id> opens
  // the Campaigns composer with that audience already selected, ready to send.
  // An optional ?goal= pre-fills a matching campaign name + subject.
  const seedAud = searchParams.get("aud");
  const seedGoal = searchParams.get("goal");
  const seedContent = seedGoal && GOAL_SEED[seedGoal] ? { name: t(`p8em.emSeed_${seedGoal}_name`), subject: t(`p8em.emSeed_${seedGoal}_subject`) } : undefined;
  // ?listing=<id> — narrows the seeded audience to families who booked that listing.
  const seedListing = searchParams.get("listing");
  // ?mail=<id> — a preview row on the dashboard's Inbox card: land on the Inbox
  // with that message already open (and therefore marked read).
  const seedMail = searchParams.get("mail");
  // Head-office network scope — which network's families this Email surface is
  // acting on. Drives the "Sending within" banner and re-reads when it changes.
  const emailPortalSeg = usePathname()?.split("/")[1] || "freelancer";
  const hoScope = useHoScope();
  const [hoFranchises, setHoFranchises] = useState<{ franchiseId: string; name: string; area: string | null }[]>([]);
  useEffect(() => { if (emailPortalSeg === "company") apiGet<{ franchiseId: string; name: string; area: string | null }[]>("/api/franchises").then(setHoFranchises).catch(() => {}); }, [emailPortalSeg]);
  const isHo = emailPortalSeg === "company" && hoFranchises.length > 0;
  const scopeLabel = hoScope === HO_OWN ? t("p8em.emScopeOwn") : hoScope ? (hoFranchises.find((f) => f.franchiseId === hoScope)?.name ?? t("p8em.snThisFranchise")) : t("p8em.emScopeNetwork");
  // Gmail-style bright background theme for the Email surface (its own saved pick).
  const { theme, control: themeControl } = useSurfaceTheme("aos.emailTheme");
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
  const msgRef = useRef<HTMLDivElement | null>(null);       // the message editor — jumped to on reply/forward
  const [jumpMsg, setJumpMsg] = useState(0);                // bump to scroll+focus the editor (reply/forward)
  useEffect(() => {
    if (!jumpMsg) return;
    const id = setTimeout(() => {
      // scrollIntoView finds the real scroll container; the negative
      // scroll-margin-top on the wrapper lands it ~5cm further into the box.
      const ed = msgRef.current?.querySelector('[contenteditable="true"]') as HTMLElement | null;
      msgRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      ed?.focus({ preventScroll: true });
    }, 160);
    return () => clearTimeout(id);
  }, [jumpMsg]);
  const [sender, setSender] = useState<SenderIdentity | null>(null); // who this tenant's mail goes out as
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedAt, setSchedAt] = useState("");
  const [undoSend, setUndoSend] = useState<{ payload: Record<string, unknown>; count: number; hadAttachments: boolean } | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);
  const undoFired = useRef(false);
  const [undoEnq, setUndoEnq] = useState<{ name: string; location?: string; prev: EnquiryRec[] } | null>(null);
  const [undoEnqLeft, setUndoEnqLeft] = useState(0);
  const [campaignSeedId, setCampaignSeedId] = useState<string | null>(seedAud || null); // audience picked from a card's "Use in campaign", or a ?aud= deep-link
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
  const [tab, setTab] = useState<Tab>(seedAud ? "campaigns" : seedMail ? "inbox" : nlDraft || presetTo ? "compose" : "inbox");
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
    if (!confirm(t("p8em.emDelPhotoConfirm"))) return;
    save({ settings: { ...settings, emailAssets: { ...(settings.emailAssets ?? {}), images: savedImages.filter((im) => im.id !== id) } } });
  }
  // Add the photo to the email draft as ONE composed image — the message + quote
  // baked in exactly like the Moments card, so the text is part of the picture
  // (not separate text below it). Embedded inline + resizable.
  async function addImageToEmail(im: SavedImage) {
    // Escapes quotes as well: this lands inside alt="…" and is set via innerHTML,
    // so a child named  x"onload="…  must stay text (acceptance test d26s7).
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
    let block = `<img src="${esc(src)}" alt="${esc(im.childName ?? t("p8em.emPhotoAlt"))}" style="max-width:100%;border-radius:10px">`;
    if (!composed) { // raw photo — add the message/quote as text since it isn't baked in
      if (caption) block += `<div style="margin-top:6px">${esc(caption)}</div>`;
      for (const q of quotes) block += `<div style="color:#5f6672"><i>“${esc(q.text)}”</i> — ${esc(q.byName ?? t("p8em.emAParent"))}</div>`;
    }
    setBody((b) => b.trim() ? `${b}<br><br>${block}` : block);
    setOk(t("p8em.emPhotoAddedLib"));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const refresh = useCallback(() => {
    apiGet<Sent[]>("/api/emails").then((h) => { setHistory(h); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : tNow("p8em.cLoadFailed")));
    // A tenant's forwarded inbox accumulates over years; useRealtime refires this
    // on every emails/emailMessages/scheduledEmails/bookings/moments change
    // tenant-wide. Bail out of the state update (keep the same array reference)
    // when the payload is content-identical to what's loaded, so the folder-count
    // and list memos above don't re-derive over the full inbox for nothing.
    apiGet<ServerMail[]>("/api/emails/messages").then((m) => {
      const next = m && m.length ? m : isDemoMode() ? DEMO_INBOX : [];
      setMessages((prev) => { try { if (prev && prev.length === next.length && JSON.stringify(prev) === JSON.stringify(next)) return prev; } catch { /* fall through */ } return next; });
    }).catch(() => setMessages(isDemoMode() ? DEMO_INBOX : []));
    apiGet<Scheduled[]>("/api/emails/scheduled").then(setScheduled).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // Consume the newsletter hand-off once so it doesn't re-fill on a later visit.
  useEffect(() => { try { localStorage.removeItem("aos.email.draft.v1"); } catch { /* private mode */ } }, []);
  const loadRecipients = useCallback(() => { apiGet<{ count: number; families?: { email: string; name: string }[] }>(withNet("/api/emails/recipients")).then((r) => { setReach(r.count); setFamilies(r.families ?? []); }).catch(() => {}); }, [hoScope]);
  useEffect(() => { loadRecipients(); }, [loadRecipients]);
  useEffect(() => { apiGet<LiveMoment[]>("/api/moments").then(setMoments).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string; venueId?: string }[]>("/api/listings?mine=1").then((l) => setComposeListings(l.map((x) => ({ id: x.id, title: x.title || x.name || tNow("p8em.emListingWord"), venueId: x.venueId })))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ venues?: { id: string; name?: string; city?: string }[] } | null>("/api/library").then((lib) => setVenueName(Object.fromEntries((lib?.venues ?? []).map((v) => [v.id, v.name || v.city || tNow("p8em.emVenueWord")])))).catch(() => {}); }, []);
  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setComposeBookings).catch(() => {}); }, []);
  useEffect(() => { apiGet<SenderIdentity>("/api/emails/sender").then(setSender).catch(() => {}); }, []);
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
    for (const b of composeBookings) { const key = b.listingId || bookingListing(b); const title = bookingListing(b) || key; if (!key || !title || liveIds.has(key) || liveTitles.has(title) || seen.has(key)) continue; seen.add(key); opts.push({ key, title, live: false }); }
    return opts;
  })();
  // A picked LIVE listing is keyed by its id, but a booking only carries
  // `listingId` when the server stamped one — manual and older bookings just
  // name the listing. So match on the picked options' TITLES as well, or those
  // bookings can never be selected and the count sits at 0 however many exist.
  const selectedTitles = new Set(listingOpts.filter((o) => listingIds.includes(o.key)).map((o) => o.title));
  // Distinct families per listing, so a chip can say what picking it would
  // actually reach. Without it the only way to discover an empty listing is to
  // tick it and watch the total not move.
  const listingCounts = (() => {
    const byId = new Map(listingOpts.map((o) => [o.key, o.key] as const));
    const byTitle = new Map(listingOpts.map((o) => [o.title, o.key] as const));
    const counts = new Map(listingOpts.map((o) => [o.key, new Set<string>()] as const));
    for (const b of composeBookings) {
      if (!b.email) continue;
      const title = bookingListing(b);
      const key = (b.listingId && byId.get(b.listingId)) || (title ? byTitle.get(title) : undefined);
      if (key) counts.get(key)?.add(b.email.toLowerCase());
    }
    return new Map([...counts].map(([k, set]) => [k, set.size] as const));
  })();
  const bookingMatchesSel = (b: Booking) =>
    listingIds.includes(b.listingId || "\0") || selectedTitles.has(bookingListing(b) || "\0");
  // Recipients when targeting by listing: distinct emails booked on any selected
  // listing (a repeat parent across duplicated listings only appears once).
  const composeLocations = [...new Set(composeListings.map((l) => (l.venueId ? venueName[l.venueId] : undefined)).filter((x): x is string => !!x))].sort();
  const addEnquiry = (m: Mail, locations: string[]) => {
    const email = (m.fromEmail || "").toLowerCase();
    if (!email) { setError(t("p8em.emSenderNoAddr")); return; }
    const prev = readLS<EnquiryRec[]>(LS_ENQ, []);
    const at = new Date().toISOString().slice(0, 10);
    const wanted = locations.length ? locations : [undefined]; // no selection → one "no specific location" record
    const additions = wanted
      .filter((loc) => !prev.some((e) => e.email.toLowerCase() === email && (e.location || undefined) === (loc || undefined)))
      .map((loc) => ({ email, name: m.from, location: loc || undefined, at } as EnquiryRec));
    if (!additions.length) { setError(null); setOk(t(locations.length ? "p8em.emAlreadyBoards" : "p8em.emAlreadyBoard", { from: m.from })); return; }
    writeLS(LS_ENQ, [...additions, ...prev]);
    setError(null); setOk(null);
    setUndoEnq({ name: m.from, location: locations.join(", ") || undefined, prev }); setUndoEnqLeft(5);
  };
  const listingFamilies = (() => { const m = new Map<string, string>(); for (const b of composeBookings) { if (!b.email || !bookingMatchesSel(b)) continue; const e = b.email.toLowerCase(); if (!m.has(e)) m.set(e, bookerName(b) || b.email); } return [...m].map(([email, name]) => ({ email, name })); })();
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
      setOk(t("p8em.emPhotoAdded"));
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError(t("p8em.emPhotoAddFail")); }
  }
  // "Help me write" — draft/extend the email body from a short brief via the AI writer.
  const [aiBusy, setAiBusy] = useState(false);
  async function aiWrite() {
    const notes = window.prompt(t("p8em.emAiPrompt"));
    if (!notes?.trim()) return;
    setAiBusy(true); setError(null);
    try {
      const r = await apiPost<{ title: string; body: string }>("/api/ai/compose", { kind: "announce", notes: notes.trim(), length: "medium" });
      if (r.title && !subject.trim()) setSubject(r.title);
      if (r.body) setBody((bd) => bd.trim() ? `${bd}<br><br>${mdToHtml(r.body)}` : mdToHtml(r.body));
    } catch (e) { setError(e instanceof Error ? e.message : t("p8em.nfAiFail")); }
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
  // A single-address or manual "also send to" email is transactional — it must
  // send to exactly the addresses typed, never get consent-filtered as a family
  // broadcast (which strips non-family addresses and can leave zero recipients).
  const manualSend = audience === "one" || audience === "none";

  // Fire the actual API send with a snapshotted payload, then clear the composer.
  const dispatchSend = useCallback(async (payload: Record<string, unknown>, hadAttachments: boolean) => {
    setSending(true); setError(null); setOk(null);
    try {
      const r = await apiPost<{ recipientCount: number }>(withNet("/api/emails/send"), payload);
      setOk(pickPlural(tNow, currentLocaleCode(), "p8em.emSentOk", r.recipientCount) + (hadAttachments ? tNow("p8em.emAttachNote") : ""));
      setSubject(""); setBody(""); setTo(""); setCc([]); setBcc([]); setCcInput(""); setBccInput(""); setExtraTo([]); setAttachments([]); setReplyTo(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : tNow("p8em.snCouldntSend")); }
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
    if (!subject.trim() || !bodyText.trim()) { setError(t("p8em.emNeedSubjMsg")); return; }
    if (audience === "one" && !to.trim() && extraTo.length === 0) { setError(t("p8em.emNeedAddr")); return; }
    if (audience === "listing" && listingIds.length === 0) { setError(t("p8em.emPickListingFirst")); return; }
    const count = finalRecipients.length;
    if (count === 0) { setError(t("p8em.emNoRecipsSel")); return; }
    const payload: Record<string, unknown> = {
      subject, body: bodyText + (selectedSig ? `\n\n${htmlToText(selectedSig.html)}` : ""),
      html: (docHtml && mode === "embed" ? docHtml : body) + (selectedSig ? `<br><br>${selectedSig.html}` : ""),
      // Manual/single sends are transactional ("one"); family broadcasts are "all".
      audience: manualSend ? "one" : "all",
      ...(manualSend && finalRecipients[0] ? { to: finalRecipients[0] } : {}),
      recipients: finalRecipients, cc: cc.length ? cc.join(",") : undefined, bcc: bcc.length ? bcc.join(",") : undefined,
    };
    const secs = settings.emailPrefs?.undoSeconds ?? 0;   // instant send by default; opt into a grace period in Settings
    if (secs > 0) { setError(null); setOk(null); setUndoSend({ payload, count, hadAttachments: attachments.length > 0 }); setUndoLeft(secs); return; }
    if (!confirm(pickPlural(t, locale, "p8em.emSendConfirm", count))) return;
    void dispatchSend(payload, attachments.length > 0);
  }

  // Schedule the email for later: the full composed payload is queued
  // server-side and a background job fires it at sendAt. Cancellable from the
  // Inbox → Scheduled folder until then.
  async function scheduleSend() {
    const bodyText = htmlToText(body);
    if (!subject.trim() || !bodyText.trim()) { setError(t("p8em.emNeedSubjMsg")); return; }
    if (finalRecipients.length === 0) { setError(t("p8em.emNoRecipsSel")); return; }
    if (!schedAt || new Date(schedAt) <= new Date()) { setError(t("p8em.emPickFuture")); return; }
    setSending(true); setError(null); setOk(null);
    try {
      await apiPost(withNet("/api/emails/schedule"), {
        subject, body: bodyText + (selectedSig ? `\n\n${htmlToText(selectedSig.html)}` : ""),
        html: (docHtml && mode === "embed" ? docHtml : body) + (selectedSig ? `<br><br>${selectedSig.html}` : ""),
        audience: manualSend ? "one" : "all", ...(manualSend && finalRecipients[0] ? { to: finalRecipients[0] } : {}),
        recipients: finalRecipients,
        cc: cc.length ? cc.join(",") : undefined, bcc: bcc.length ? bcc.join(",") : undefined,
        sendAt: schedAt,
      });
      setOk(t("p8em.emScheduledOk", { when: whenSched(schedAt) }));
      setSchedOpen(false); setSubject(""); setBody(""); setTo(""); setCc([]); setBcc([]); setCcInput(""); setBccInput(""); setExtraTo([]); setAttachments([]); setSchedAt(""); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("p8em.emCouldntSchedule")); }
    finally { setSending(false); }
  }

  return (
    <OperatorPage title={t("p8em.emTitle")} icon="✉️" lede={t("p8em.emLede")} actions={themeControl} background={theme.page} heroBackground={theme.hero}>
      <TabStrip<Tab> tabs={(["inbox", "compose", "campaigns", "audiences", "templates", "automatic", "analytics", "settings"] as const).map((k) => [k, t("p8em.emTab_" + k)] as [Tab, string])} value={tab} onChange={setTab} />
      {isHo && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px]" style={hoScope === HO_OWN ? { borderColor: "#f0c98a", background: "#fdf6ea", color: "#8a6d1a" } : hoScope ? { borderColor: "#b9d0f7", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "#c7bdf2", background: "#f2effc", color: "#4a2fb0" }}>
          <span className="text-[14px]">📡</span>
          <span><RichB text={t("p8em.emHoSending", { scope: scopeLabel })} /></span>
          <span className="opacity-80">{hoScope === HO_OWN ? t("p8em.emHoOwn") : hoScope ? t("p8em.emHoOne") : t("p8em.emHoAll")}</span>
          <span className="ms-auto opacity-70">{t("p8em.emHoChange")}</span>
        </div>
      )}
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}
      {undoEnq && (
        <div className="fixed bottom-6 left-1/2 z-[140] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] px-4 py-3 shadow-[0_12px_40px_-8px_rgba(18,122,62,.4)]">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[14px] text-white shadow-sm" style={{ background: "linear-gradient(180deg,#33b06a,#127a3e)" }}>✓</span>
          <span className="text-[13px] font-semibold text-[var(--ink)]"><RichB text={t("p8em.emEnqAdded", { name: undoEnq.name, loc: undoEnq.location ? t("p8em.emEnqAddedLoc", { loc: undoEnq.location }) : "" })} /></span>
          <span className="relative flex h-7 w-7 flex-none items-center justify-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="#eafaf0" strokeWidth="4" /><circle cx="18" cy="18" r="15" fill="none" stroke="#127a3e" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - undoEnqLeft / 5)} style={{ transition: "stroke-dashoffset 1s linear" }} /></svg>
            <span className="text-[11px] font-extrabold tabular-nums text-[#127a3e]">{undoEnqLeft}</span>
          </span>
          <button type="button" onClick={() => { writeLS(LS_ENQ, undoEnq.prev); setUndoEnq(null); setUndoEnqLeft(0); setOk(t("p8em.emUndoneEnq")); }} className="flex-none rounded-lg px-3.5 py-1.5 text-[12.5px] font-extrabold text-white shadow-sm" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>{t("p8em.emUndoBtn")}</button>
        </div>
      )}

      {tab === "inbox" && <InboxView seedMail={seedMail} history={history} messages={messages} scheduled={scheduled} onRefresh={refresh} locations={composeLocations} onEnquiry={addEnquiry} onCompose={() => { setReplyTo(null); setTab("compose"); }} onReply={(m) => { setAudience("one"); if (m.fromEmail) setTo(m.fromEmail); setReplyTo({ name: m.from, email: m.fromEmail ?? "" }); setSubject(`Re: ${m.subject}`); setBody(mdToHtml(`\n\n———\n${t("p8em.emWrote", { from: m.from })}\n${m.body ?? m.preview}`)); setSigChoice(settings.emailPrefs?.replySignatureId ?? ""); setTab("compose"); setJumpMsg((n) => n + 1); }} onQuickReply={(m, text) => { setAudience("one"); if (m.fromEmail) setTo(m.fromEmail); setReplyTo({ name: m.from, email: m.fromEmail ?? "" }); setSubject(`Re: ${m.subject}`); setBody(mdToHtml(text)); setSigChoice(settings.emailPrefs?.replySignatureId ?? ""); setTab("compose"); setJumpMsg((n) => n + 1); }} onForward={(m) => { setAudience("one"); setTo(""); setReplyTo(null); setSubject(`Fwd: ${m.subject}`); setBody(mdToHtml(`\n\n———\n${t("p8em.emForwardedFrom", { from: m.from })}\n${m.body ?? m.preview}`)); setSigChoice(settings.emailPrefs?.replySignatureId ?? ""); setTab("compose"); setJumpMsg((n) => n + 1); }} />}
      {tab === "campaigns" && <CampaignsView onSent={refresh} seedAudienceId={campaignSeedId} seedName={seedContent?.name} seedSubject={seedContent?.subject} seedListingId={seedListing} onSeedConsumed={() => setCampaignSeedId(null)} company={{ name: settings.providerName || settings.billing?.businessName || "", phone: settings.billing?.phone, email: settings.billing?.email, address: settings.billing?.address, logo: settings.billing?.logoUrl }} socials={Object.entries(settings.social ?? {}).filter(([, v]) => v).map(([net, url]) => ({ net, url: url as string }))} />}
      {tab === "audiences" && <AudiencesView onUse={(a) => { setCampaignSeedId(a.id); setTab("campaigns"); }} payMethods={settings.payMethods ?? []} seasons={settings.seasons ?? []} />}
      {tab === "templates" && <TemplatesView onUse={(t) => { setSubject(t.subject ?? ""); setBody(mdToHtml(t.body)); setTab("compose"); }} company={{ name: settings.providerName || settings.billing?.businessName || "", phone: settings.billing?.phone, email: settings.billing?.email, address: settings.billing?.address, logo: settings.billing?.logoUrl }} socials={Object.entries(settings.social ?? {}).filter(([, v]) => v).map(([net, url]) => ({ net, url: url as string }))} />}
      {tab === "analytics" && <AnalyticsView />}
      {tab === "automatic" && <AutoEmails settings={settings} save={save} />}
      {tab === "settings" && <EmailPrefs settings={settings} save={save} />}

      {tab === "compose" && (<>
      {undoSend && <div className="mb-3 flex items-center gap-3 rounded-lg border border-[#E4E9F5] bg-[#E8EEFD] px-3 py-2 text-[12.5px] font-semibold text-[#2f5fd0]"><span>{pickPlural(t, locale, "p8em.emUndoBanner", undoSend.count, { s: undoLeft })}</span><button type="button" onClick={() => { setUndoSend(null); setUndoLeft(0); setOk(t("p8em.emSendCancelled")); }} className="ms-auto rounded-md bg-[var(--surface)] px-3 py-1 text-[12px] font-extrabold text-[#2f5fd0] shadow-sm">{t("p8em.emUndoBtn")}</button></div>}
      {designedDoc && (
        <div className="mb-4 rounded-2xl border-2 border-[#2f6bd8] bg-[#f4f8ff] p-4">
          <div className="text-[14px] font-extrabold text-[#1d3a8f]">{docHtml ? t("p8em.emDocNewsletter") : t("p8em.emDocMedia")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["embed", t("p8em.emDocEmbed")], ["attach", t("p8em.emDocAttach")]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => setMode(k)} className="rounded-lg border-2 px-3.5 py-2 text-[13px] font-extrabold" style={mode === k ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{mode === k ? "✓ " : ""}{label}</button>)}
            <button type="button" onClick={() => printDocHtml(designedDoc)} className="ms-auto rounded-lg border border-[#1d3a8f] px-3 py-2 text-[12.5px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">{t("p8em.emDocPdfBtn")}</button>
          </div>
          <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">{mode === "embed" ? t("p8em.emDocEmbedHint") : <RichB className="text-[#8a6d1a]" text={t("p8em.emDocAttachHint")} />}</div>
        </div>
      )}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/15 text-[17px]">✉️</span>
          <div><div className="text-[14.5px] font-extrabold">{t("p8em.emComposeTitle")}</div><div className="text-[11.5px] text-white/80">{t("p8em.emComposeSub")}</div></div>
        </div>
        <div className="p-4">
        {!replyTo && <div className="-mx-4 -mt-4 mb-3.5 flex items-center gap-2 border-b border-[var(--line)] px-4 py-2.5" style={{ background: "linear-gradient(120deg,#eef4fd,#e6fbf7)" }}><span className="grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#4f8bf5,#2f6bd8)" }}>1</span><span className="text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[#12306e]">{t("p8em.snWho")}</span></div>}
        {replyTo ? (
          <div className="rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#3f78d8,#16306e)" }}>{replyTo.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              <span className="text-[13px] font-bold text-[var(--ink)]">{t("p8em.emReplyTo", { name: replyTo.name })}</span>
              {replyTo.email && <span className="text-[12px] text-[var(--ink-3)]">{replyTo.email}</span>}
              <button type="button" onClick={() => setReplyTo(null)} className="ms-auto text-[11.5px] font-bold text-[#1d3a8f]">{t("p8em.emSendMore")}</button>
            </div>
            <div className="mt-2"><FieldLabel>{t("p8em.emToLbl")}</FieldLabel><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="w-full" /></div>
          </div>
        ) : (
          <div>
            <FieldLabel>{t("p8em.emSendToLbl")}</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-2">
              {([
                ["all", "👨‍👩‍👧", t("p8em.emAud_all"), families.length ? included.length : reach ?? 0],
                ["listing", "🎟", t("p8em.emAud_listing"), null],
                ["one", "✉️", t("p8em.emAud_one"), null],
              ] as [("all" | "listing" | "one" | "none"), string, string, number | null][]).map(([k, icon, label, count]) => {
                const on = audience === k;
                return (
                  <button key={k} type="button" onClick={() => setAudience(k)}
                    className="rounded-xl border px-3.5 py-2.5 text-[12.5px] font-extrabold transition active:scale-[.98]"
                    style={on ? { borderColor: "transparent", background: "linear-gradient(135deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 6px 14px -6px rgba(47,107,216,.6)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
                    {icon} {label}{count != null ? <span className={on ? "text-white/80" : "text-[var(--ink-3)]"}> {count}</span> : null}
                  </button>
                );
              })}
            </div>
            {audience === "one" && <div className="mt-2.5 sm:max-w-[380px]"><FieldLabel>{t("p8em.emRecipientLbl")}</FieldLabel><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="w-full" /></div>}
          </div>
        )}
        {sender && (
          <p data-ui="sending-as" className="mt-2 text-[11.5px] text-[var(--ink-3)]">
            <RichB className="text-[var(--ink-2)]" text={t("p8em.emSendingAs", { name: sender.fromName, addr: sender.fromAddress })} />
            {sender.replyTo
              ? <RichB className="text-[var(--ink-2)]" text={t("p8em.emRepliesGo", { to: sender.replyTo })} />
              : <> · <span className="text-[#b45309]">{t("p8em.emNoReplyAddr")}</span></>}
          </p>
        )}
        {audience === "listing" && (
          <div className="mt-2">
            <FieldLabel>{t("p8em.emListingsPick", { n: listingEmails.length })}</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {listingOpts.length === 0 ? <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8em.nfNoListings")}</span>
                : listingOpts.map((l) => { const on = listingIds.includes(l.key); const n = listingCounts.get(l.key) ?? 0; return <button key={l.key} type="button" title={n ? pickPlural(t, locale, "p8em.emFamBooked", n) : t("p8em.emNobodyBooked")} onClick={() => setListingIds((xs) => on ? xs.filter((x) => x !== l.key) : [...xs, l.key])} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={on ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)", opacity: n ? 1 : 0.45 }}>{on ? "✓ " : ""}{l.title}<span className="ms-1 text-[10px] font-semibold text-[var(--ink-3)]">· {n}</span>{!l.live && <span className="ms-1 text-[10px] font-semibold text-[var(--ink-3)]">{t("p8em.emPastTag")}</span>}</button>; })}
            </div>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">{t("p8em.emListingNote")}</p>
          </div>
        )}
        {audience !== "one" && reachCount > 1 && <p className="mt-2 text-[11.5px] font-semibold text-[#127a3e]">{t("p8em.emOwnCopy")}</p>}
        <div className="mt-2">
          {showCcBcc ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div><FieldLabel>Cc</FieldLabel><div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5">{cc.map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[#eef4fd] px-2 py-0.5 text-[12px] font-bold text-[#1d3a8f]">{e}<button type="button" onClick={() => setCc((xs) => xs.filter((x) => x !== e))} className="text-[#1d3a8f]">×</button></span>)}<input value={ccInput} onChange={(e) => setCcInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCc(); } }} onBlur={addCc} placeholder={`cc@example.com ${t("p8em.emEnterToAdd")}`} className="min-w-[130px] flex-1 bg-transparent px-1.5 py-1 text-[12.5px] outline-none" /></div></div>
              <div><FieldLabel>Bcc</FieldLabel><div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5">{bcc.map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[#eef4fd] px-2 py-0.5 text-[12px] font-bold text-[#1d3a8f]">{e}<button type="button" onClick={() => setBcc((xs) => xs.filter((x) => x !== e))} className="text-[#1d3a8f]">×</button></span>)}<input value={bccInput} onChange={(e) => setBccInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addBcc(); } }} onBlur={addBcc} placeholder={`bcc@example.com ${t("p8em.emEnterToAdd")}`} className="min-w-[130px] flex-1 bg-transparent px-1.5 py-1 text-[12.5px] outline-none" /></div></div>
            </div>
          ) : <button type="button" onClick={() => setShowCcBcc(true)} className="text-[12px] font-bold text-[#1d3a8f]">{t("p8em.emAddCcBcc")}</button>}
        </div>
        {!replyTo && (
          <div className="mt-2">
            <FieldLabel>{t("p8em.emAlsoSend")}</FieldLabel>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5">
              {extraTo.map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[#eef4fd] px-2 py-0.5 text-[12px] font-bold text-[#1d3a8f]">{e}<button type="button" onClick={() => setExtraTo((xs) => xs.filter((x) => x !== e))} className="text-[#1d3a8f]">×</button></span>)}
              <input value={extraInput} onChange={(e) => setExtraInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addExtra(); } }} onBlur={addExtra} placeholder={`name@example.com ${t("p8em.emEnterToAdd")}`} className="min-w-[180px] flex-1 bg-transparent px-1.5 py-1 text-[12.5px] outline-none" />
            </div>
          </div>
        )}
        {audience !== "one" && audienceFamilies.length > 0 && (
          <div className="mt-2">
            <button type="button" onClick={() => setRecipOpen((o) => !o)} className="text-[12px] font-bold text-[#1d3a8f]">{recipOpen ? "▾" : "▸"} {pickPlural(t, locale, "p8em.emReview", reachCount)}</button>
            {recipOpen && (() => { const q = recipQuery.trim().toLowerCase(); const shown = q ? audienceFamilies.filter((f) => `${f.name} ${f.email}`.toLowerCase().includes(q)) : audienceFamilies; return (
              <div className="mt-1.5 rounded-lg border border-[var(--line)]">
                <div className="border-b border-[var(--line)] p-1.5"><input value={recipQuery} onChange={(e) => setRecipQuery(e.target.value)} placeholder={t("p8em.emSearchFamPh")} className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#2f6bd8]" /></div>
                <div className="max-h-56 divide-y divide-[var(--line)] overflow-auto">
                  {shown.length === 0 ? <div className="px-3 py-4 text-center text-[12px] text-[var(--ink-3)]">{t("p8em.emNoFamMatch", { q: recipQuery.trim() })}</div>
                  : shown.map((f) => { const on = !excluded.has(f.email); return (
                    <div key={f.email} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]" style={on ? undefined : { opacity: 0.5 }}>
                      <span className="min-w-0 flex-1 truncate"><b>{f.name}</b> <span className="text-[var(--ink-3)]">{f.email}</span></span>
                      <button type="button" onClick={() => setExcluded((s) => { const n = new Set(s); if (on) n.add(f.email); else n.delete(f.email); return n; })} className="flex-none rounded-md border px-2 py-0.5 text-[11px] font-bold" style={on ? { borderColor: "var(--line)", color: "var(--ink-2)" } : { borderColor: "#1d3a8f", color: "#1d3a8f" }}>{on ? t("p8em.cRemove") : t("p8em.emAddBackPlain")}</button>
                    </div>
                  ); })}
                </div>
              </div>
            ); })()}
          </div>
        )}
        {!replyTo && <div className="-mx-4 my-3.5 flex items-center gap-2 border-y border-[var(--line)] px-4 py-2.5" style={{ background: "linear-gradient(120deg,#eef4fd,#e6fbf7)" }}><span className="grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#4f8bf5,#2f6bd8)" }}>2</span><span className="text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[#12306e]">{t("p8em.emYourMsgStep")}</span></div>}
        {replyTo && <div className="mt-2" />}
        <div className="mt-2.5"><FieldLabel>{t("p8em.cSubject")}</FieldLabel><Input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full" /></div>
        <div ref={msgRef} className="mt-2.5 [scroll-margin-top:-150px]">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><FieldLabel>{t("p8em.cMessage")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={aiWrite} disabled={aiBusy} className="rounded-md border border-[#7c3aed] px-2 py-1 text-[12px] font-extrabold text-[#7c3aed] hover:bg-[#f5f0ff] disabled:opacity-50">{aiBusy ? t("p8em.emWritingSp") : t("p8em.nfHelpWrite")}</button>
              <label title={t("p8em.emPhotoBtnTip")} className="cursor-pointer rounded-md border border-[var(--line)] px-2 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.emPhotoBtn")}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void insertPhoto(f); e.target.value = ""; }} /></label>
              <label title={t("p8em.emAttachBtnTip")} className="cursor-pointer rounded-md border border-[var(--line)] px-2 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.emAttachBtn")}<input type="file" multiple className="hidden" onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => { if (f.type.startsWith("image/") && confirm(t("p8em.emEmbedImgConfirm", { name: f.name }))) void insertPhoto(f); else addAttachment(f); }); e.target.value = ""; }} /></label>
              {composeTemplates.length > 0 && <Select value="" onChange={(e) => { const t = composeTemplates.find((x) => x.id === e.target.value); if (t && templateUsable(t)) { if (t.subject && !subject.trim()) setSubject(t.subject); setBody((b) => b.trim() ? `${b}<br><br>${mdToHtml(t.body)}` : mdToHtml(t.body)); } }} className="text-[12px]"><option value="">{t("p8em.emInsertTpl")}</option>{composeTemplates.map((tp) => { const ok = templateUsable(tp); return <option key={tp.id} value={tp.id} disabled={!ok}>{tp.name}{ok ? "" : t("p8em.emPerBookingOnly")}</option>; })}</Select>}
            </div>
          </div>
          <RichText value={body} onChange={setBody} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emSigLbl")}</span>
            <Select value={selectedSig ? selectedSig.id : "none"} onChange={(e) => { const v = e.target.value; if (v === "__manage") { setSigMgr(true); return; } setSigChoice(v === "none" ? "" : v); }} className="text-[12px]">
              <option value="none">{t("p8em.emNoSignature")}</option>
              {signatures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__manage">{t("p8em.emManageSigs")}…</option>
            </Select>
          </div>
          {selectedSig && <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3"><div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.emSigAdded")}</div><div className="text-[12.5px] text-[var(--ink-2)]" dangerouslySetInnerHTML={{ __html: selectedSig.html }} /></div>}
          {attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[12px] font-bold">📎 {a.name} <span className="font-normal text-[var(--ink-3)]">{a.size}</span><button type="button" onClick={() => setAttachments((xs) => xs.filter((_, j) => j !== i))} className="text-[var(--ink-3)] hover:text-[#c02636]">×</button></span>)}</div>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="relative inline-flex">
            <button type="button" onClick={send} disabled={sending} className="rounded-s-lg bg-[#1d3a8f] px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-50">{sending ? t("p8em.emSending") : pickPlural(t, locale, "p8em.emSendBtn", finalRecipients.length)}</button>
            <button type="button" onClick={() => setSchedOpen((o) => !o)} disabled={sending} aria-label={t("p8em.emSchedSendAria")} className="rounded-e-lg border-s border-white/30 bg-[#1d3a8f] px-2.5 py-2 text-[12px] font-bold text-white disabled:opacity-50">▲</button>
            {schedOpen && (
              <div className="absolute bottom-full start-0 z-20 mb-1.5 w-72 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-xl">
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-extrabold text-[var(--ink)]">{t("p8em.emSchedSendTitle")}</div>
                <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#2f6bd8]" />
                <div className="mt-2 flex gap-2"><button type="button" onClick={scheduleSend} className="flex-1 rounded-md bg-[#1d3a8f] px-3 py-1.5 text-[12.5px] font-extrabold text-white">{t("p8em.nfSchedule")}</button><button type="button" onClick={() => setSchedOpen(false)} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">{t("p8em.cCancel")}</button></div>
                <div className="mt-1.5 text-[10.5px] text-[var(--ink-3)]">{t("p8em.emHeldQueue")}</div>
              </div>
            )}
          </div>
          {reachCount === 0 && extraTo.length === 0 && audience !== "one" && <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8em.emNoRecipsYet")}</span>}
        </div>
        </div>
      </Card>

      {savedImages.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#f6e2a8] bg-[#fffdf3] p-3.5">
          <button type="button" onClick={() => setAssetsOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-start">
            <span className="flex items-center gap-2 text-[13px] font-extrabold" style={{ color: "var(--ink-2)", fontFamily: "var(--ff-display)" }}>{assetsOpen ? "📂" : "📁"} {t("p8em.emPhotosFromMoments")} <span className="rounded-full bg-[#FCF1DC] px-2 py-0.5 text-[11px] font-extrabold text-[var(--ink-2)]">{savedImages.length}</span>{assetsOpen && <span className="text-[11px] font-semibold text-[var(--ink-3)]">{t("p8em.emMomentsHint")}</span>}</span>
            <span className="flex-none rounded-full border border-[#f0d488] px-2.5 py-0.5 text-[11.5px] font-bold text-[#8a5a00]">{assetsOpen ? t("p8em.emCloseFolder") : t("p8em.emOpenFolder")}</span>
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

      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8em.emFolder_sent")}</div>
      {!history ? <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8em.cLoading")}</div>
      : history.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{t("p8em.emNothingSent")}</Card>
      : (
        <div className="flex flex-col gap-1.5">
          {history.map((h) => (
            <Card key={h.id} className="flex flex-wrap items-center gap-2 p-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{h.subject}</span>
              <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{h.audience === "one" ? t("p8em.emBadgeAddr") : pickPlural(t, locale, "p8em.emBadgeFam", h.recipientCount)}</Badge>
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
