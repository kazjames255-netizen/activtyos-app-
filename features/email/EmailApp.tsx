"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import type { SavedImage } from "@/lib/settings";
import { composeMomentImage, resolveSavedText, triggerDownload } from "@/lib/momentImage";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { printNewsletter, type Newsletter } from "@/features/newsfeed/newsletter";

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
  const nlDraft = typeof window === "undefined" ? null : ((): { subject?: string; body?: string; newsletter?: Newsletter } | null => { try { return JSON.parse(localStorage.getItem("aos.email.draft.v1") || "null"); } catch { return null; } })();
  const [nlAttach] = useState<Newsletter | null>(() => nlDraft?.newsletter ?? null);
  const [history, setHistory] = useState<Sent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(nlDraft ? "Your newsletter is ready to send — review the subject and message, then send to your families." : null);
  const [audience, setAudience] = useState<"all" | "one">(presetTo ? "one" : "all");
  const [to, setTo] = useState(presetTo);
  const [subject, setSubject] = useState(nlDraft?.subject ?? "");
  const [body, setBody] = useState(nlDraft?.body ?? "");
  const [reach, setReach] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [moments, setMoments] = useState<LiveMoment[] | null>(null);
  const { settings, save } = useSettings();
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
  useEffect(() => { apiGet<{ count: number }>("/api/emails/recipients").then((r) => setReach(r.count)).catch(() => {}); }, []);
  useEffect(() => { apiGet<LiveMoment[]>("/api/moments").then(setMoments).catch(() => {}); }, []);
  useRealtime(["emails", "bookings", "moments"], () => { refresh(); apiGet<{ count: number }>("/api/emails/recipients").then((r) => setReach(r.count)).catch(() => {}); apiGet<LiveMoment[]>("/api/moments").then(setMoments).catch(() => {}); });

  async function send() {
    if (!subject.trim() || !body.trim()) { setError("A subject and a message are required."); return; }
    if (audience === "one" && !to.trim()) { setError("Enter a recipient address."); return; }
    const count = audience === "one" ? 1 : reach ?? 0;
    if (!confirm(audience === "one" ? `Send this email to ${to}?` : `Send this email to ${count} famil${count === 1 ? "y" : "ies"}?`)) return;
    setSending(true); setError(null); setOk(null);
    try {
      const r = await apiPost<{ recipientCount: number }>("/api/emails/send", { subject, body, audience, to: audience === "one" ? to : undefined });
      setOk(`Sent to ${r.recipientCount} recipient${r.recipientCount === 1 ? "" : "s"}.`);
      setSubject(""); setBody(""); setTo(""); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send"); }
    finally { setSending(false); }
  }

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Email</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Email your families out of app — everyone who’s booked, or a single address.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

      <Card className="mb-4 p-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <FieldLabel>Audience</FieldLabel>
            <Select value={audience} onChange={(e) => setAudience(e.target.value as "all" | "one")} className="w-full">
              <option value="all">All families{reach != null ? ` (${reach})` : ""}</option>
              <option value="one">A single address</option>
            </Select>
          </div>
          {audience === "one" && <div><FieldLabel>Recipient</FieldLabel><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="w-full" /></div>}
        </div>
        {nlAttach && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] px-3 py-2 text-[12.5px]">
            <span className="font-bold text-[#1d3a8f]">Newsletter ready</span>
            <span className="text-[var(--ink-3)]">— the title is your subject and the text is embedded in the message below.</span>
            <button type="button" onClick={() => printNewsletter(nlAttach)} className="ml-auto rounded-lg border border-[#1d3a8f] px-3 py-1 text-[12px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">⬇ Download PDF to attach</button>
          </div>
        )}
        <div className="mt-2.5"><FieldLabel>Subject</FieldLabel><Input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full" /></div>
        <div className="mt-2.5"><FieldLabel>Message</FieldLabel><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]" /></div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" onClick={send} disabled={sending}>{sending ? "Sending…" : audience === "one" ? "Send email" : `Send to ${reach ?? 0} famil${reach === 1 ? "y" : "ies"}`}</Button>
          {audience === "all" && reach === 0 && <span className="text-[11.5px] text-[var(--ink-3)]">No booked families to email yet.</span>}
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
    </div>
  );
}
