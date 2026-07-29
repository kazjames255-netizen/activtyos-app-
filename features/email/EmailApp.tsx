"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [audience, setAudience] = useState<"all" | "one">(presetTo ? "one" : "all");
  const [to, setTo] = useState(presetTo);
  const [subject, setSubject] = useState(nlDraft?.subject ?? "");
  const [body, setBody] = useState(nlDraft?.body ?? "");
  const [reach, setReach] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [moments, setMoments] = useState<LiveMoment[] | null>(null);
  const { settings, save } = useSettings();
  // Land on Compose when arriving from a hand-off (newsletter/register), else on
  // the Automatic-emails preferences (the manual's default Email view).
  const [tab, setTab] = useState<"automatic" | "compose">(nlDraft || presetTo ? "compose" : "automatic");
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
  useRealtime(["emails", "bookings", "moments"], () => { refresh(); loadRecipients(); apiGet<LiveMoment[]>("/api/moments").then(setMoments).catch(() => {}); });
  const included = families.filter((f) => !excluded.has(f.email));
  const reachCount = families.length ? included.length : reach ?? 0;

  async function send() {
    if (!subject.trim() || !body.trim()) { setError("A subject and a message are required."); return; }
    if (audience === "one" && !to.trim()) { setError("Enter a recipient address."); return; }
    const count = audience === "one" ? 1 : reachCount;
    if (count === 0) { setError("No families selected to send to."); return; }
    if (!confirm(audience === "one" ? `Send this email to ${to}?` : `Send this email to ${count} famil${count === 1 ? "y" : "ies"}?`)) return;
    setSending(true); setError(null); setOk(null);
    try {
      const r = await apiPost<{ recipientCount: number }>("/api/emails/send", {
        subject, body,
        html: docHtml && mode === "embed" ? docHtml : undefined,
        audience,
        to: audience === "one" ? to : undefined,
        recipients: audience === "all" && families.length ? included.map((f) => f.email) : undefined,
      });
      setOk(`Sent to ${r.recipientCount} recipient${r.recipientCount === 1 ? "" : "s"}.`);
      setSubject(""); setBody(""); setTo(""); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send"); }
    finally { setSending(false); }
  }

  return (
    <OperatorPage title="Email" icon="✉️" lede="The emails ActivityOS sends for you, and one-off emails to your families — everyone who’s booked, or a single address.">
      <TabStrip<"automatic" | "compose"> tabs={[["automatic", "Automatic emails"], ["compose", "Compose & send"]]} value={tab} onChange={setTab} />
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

      {tab === "automatic" && <AutoEmails settings={settings} save={save} />}

      {tab === "compose" && (<>
      <Card className="mb-4 p-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <FieldLabel>Audience</FieldLabel>
            <Select value={audience} onChange={(e) => setAudience(e.target.value as "all" | "one")} className="w-full">
              <option value="all">All families ({reachCount})</option>
              <option value="one">A single address</option>
            </Select>
          </div>
          {audience === "one" && <div><FieldLabel>Recipient</FieldLabel><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="w-full" /></div>}
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
        <div className="mt-2.5"><FieldLabel>Message</FieldLabel><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]" /></div>
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
