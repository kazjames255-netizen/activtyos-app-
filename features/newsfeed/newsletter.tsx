"use client";
/* eslint-disable @next/next/no-img-element -- newsletter images are arbitrary operator-uploaded URLs (and data previews); next/image doesn't fit. */

import { useState, type CSSProperties } from "react";
import { post as apiPost } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────
// Newsletter builder — a rich, email-style post. The operator picks one of ten
// LAYOUTS (an ordered set of blocks with seeded content) and one of a set of
// curated PALETTES (multi-colour schemes, not a single flat colour), then edits
// each slot. NewsletterView renders the result the same way in the composer
// preview, the operator feed and the parent feed.
// ─────────────────────────────────────────────────────────────────────────

export type BlockType = "banner" | "hero" | "heading" | "text" | "image" | "discount" | "button" | "columns" | "quote" | "divider" | "eventbar" | "footer";
export interface Block {
  t: BlockType;
  heading?: string; body?: string; image?: string;
  code?: string; codeDesc?: string;
  label?: string; url?: string;
  left?: string; right?: string;
  date?: string; time?: string; location?: string;
}
export interface Company { name: string; phone: string; email: string; address: string; logo?: string }
export interface Newsletter { layout: string; palette: string; company: Company; blocks: Block[] }

// Publishing metadata for a newsletter — how it's named, filed and sent. Kept
// alongside the Newsletter design so the builder owns the whole flow.
export interface NlMeta { name: string; folder: string; audScope: "all" | "listing"; audId: string; pinned: boolean; ackRequired: boolean; react: boolean; priority: "normal" | "urgent"; when: "now" | "later" | "draft"; publishAt: string }
export const newMeta = (): NlMeta => ({ name: "", folder: "", audScope: "all", audId: "", pinned: false, ackRequired: false, react: true, priority: "normal", when: "now", publishAt: "" });

// ── Curated palettes — each carries a background, a card surface, two accents,
// ink + muted text and the colour text sits on over an accent. Deliberately
// multi-hue so a newsletter reads as designed, not flat.
export interface Palette { id: string; name: string; bg: string; surface: string; accent: string; accent2: string; ink: string; muted: string; onAccent: string; band: string }

// Two-level colour: 10 FAMILIES (by mood/hue), each with 10 SCHEMES (an accent +
// a complementary second accent). Neutrals are derived from the accent so every
// scheme reads as designed, not flat. 10 × 10 = 100 schemes.
interface Family { id: string; name: string; dark?: boolean; pairs: [string, string][] }
const FAMILIES: Family[] = [
  { id: "ocean", name: "Ocean", pairs: [["#1d3a8f", "#3f78d8"], ["#0f6d8c", "#28b6c4"], ["#123a6b", "#4f9ed6"], ["#1e5fa8", "#6ec1e4"], ["#0b4f6c", "#0197b1"], ["#274690", "#5a75c4"], ["#1b3b6f", "#0a6e9e"], ["#005f73", "#0a9396"], ["#14213d", "#4361ee"], ["#003049", "#4f8fc0"]] },
  { id: "sunset", name: "Sunset", pairs: [["#f2683c", "#f5b301"], ["#e0480c", "#ff9e00"], ["#d1495b", "#edae49"], ["#bc3908", "#f6aa1c"], ["#c1121f", "#f08700"], ["#e85d04", "#faa307"], ["#dc2f02", "#f4a261"], ["#9d0208", "#e85d04"], ["#ca6702", "#ee9b00"], ["#bb3e03", "#e9853b"]] },
  { id: "forest", name: "Forest", pairs: [["#15803d", "#84b13b"], ["#2d6a4f", "#52b788"], ["#1b4332", "#40916c"], ["#386641", "#8aab3c"], ["#1a7431", "#57cc42"], ["#087e8b", "#0b6e4f"], ["#31572c", "#7f9d3c"], ["#134611", "#3da35d"], ["#2b9348", "#55a630"], ["#004b23", "#3f9d54"]] },
  { id: "berry", name: "Berry", pairs: [["#c02467", "#8b5cf6"], ["#a4133c", "#ff4d6d"], ["#b5179e", "#f72585"], ["#9d174d", "#ec4899"], ["#831843", "#db4d8a"], ["#d1006f", "#ff5d8f"], ["#7a0f4e", "#c9184a"], ["#a01a58", "#e0479e"], ["#c9184a", "#ff758f"], ["#8e2984", "#d43790"]] },
  { id: "grape", name: "Grape", pairs: [["#5b21b6", "#8b5cf6"], ["#6d28d9", "#a06cf5"], ["#4c1d95", "#7c3aed"], ["#3c096c", "#9d4edd"], ["#5a189a", "#b268f0"], ["#240046", "#7b2cbf"], ["#3a0ca3", "#4361ee"], ["#560bad", "#b5179e"], ["#7209b7", "#c026a9"], ["#480ca8", "#5b8def"]] },
  { id: "teal", name: "Teal", pairs: [["#0f766e", "#2dd4bf"], ["#036666", "#5eab8f"], ["#008080", "#20c997"], ["#0d9488", "#41d3b8"], ["#14746f", "#249ea0"], ["#005f60", "#00afb9"], ["#046865", "#28c2b8"], ["#01727a", "#54c9a8"], ["#0a9396", "#5cc3ad"], ["#006d77", "#4aa79f"]] },
  { id: "coral", name: "Coral", pairs: [["#e5674e", "#ff9770"], ["#ef6351", "#f7a072"], ["#e07a5f", "#e0a458"], ["#f4845f", "#f27059"], ["#e56b6f", "#e79b7f"], ["#d1495b", "#e08a76"], ["#cb4749", "#f4978e"], ["#e63946", "#f88379"], ["#e76f51", "#f4a261"], ["#c9584a", "#e8927c"]] },
  { id: "slate", name: "Slate", pairs: [["#334155", "#64748b"], ["#3f3f46", "#71717a"], ["#475569", "#8593a8"], ["#44403c", "#8a827a"], ["#374151", "#6b7280"], ["#1f2937", "#4b5563"], ["#3d405b", "#7d8199"], ["#2b2d42", "#8d99ae"], ["#495057", "#98a2ac"], ["#403d39", "#6c757d"]] },
  { id: "midnight", name: "Midnight", dark: true, pairs: [["#f5b301", "#5b8def"], ["#ffd60a", "#00b4d8"], ["#c77dff", "#7b2cbf"], ["#f72585", "#4cc9f0"], ["#ffbe0b", "#fb5607"], ["#64dfdf", "#5390d9"], ["#ff4d8d", "#8338ec"], ["#2ee6a5", "#00b4d8"], ["#f5b301", "#e5383b"], ["#ffca3a", "#8ac926"]] },
  { id: "candy", name: "Candy", pairs: [["#ef476f", "#ff9e00"], ["#8ac926", "#1982c4"], ["#6a4c93", "#ff924c"], ["#f15bb5", "#9b5de5"], ["#00bbf9", "#00cfa5"], ["#ee5d9b", "#f5b301"], ["#ff70a6", "#ff9770"], ["#06d6a0", "#118ab2"], ["#c05299", "#ff9770"], ["#e5484d", "#f5b301"]] },
];
const mk = (famId: string, i: number, accent: string, accent2: string, dark?: boolean): Palette => dark
  ? { id: `${famId}-${i}`, name: `${i + 1}`, bg: "#141a2e", surface: "#1e2740", accent, accent2, ink: "#eaf0ff", muted: "#9aa6c4", onAccent: "#141a2e", band: "#26314f" }
  : { id: `${famId}-${i}`, name: `${i + 1}`, bg: `${accent}0f`, surface: "#ffffff", accent, accent2, ink: "#1b2130", muted: "#5f6672", onAccent: "#ffffff", band: `${accent}1e` };
export interface PaletteFamily { id: string; name: string; schemes: Palette[] }
export const PALETTE_FAMILIES: PaletteFamily[] = FAMILIES.map((f) => ({ id: f.id, name: f.name, schemes: f.pairs.map(([a, b], i) => mk(f.id, i, a, b, f.dark)) }));
export const ALL_PALETTES: Palette[] = PALETTE_FAMILIES.flatMap((f) => f.schemes);
export const familyOfPalette = (id: string) => id.split("-")[0];
export const paletteOf = (id: string) => ALL_PALETTES.find((p) => p.id === id) ?? ALL_PALETTES[0];

// ── 10 layouts: each seeds a block list. Company details flow from the top-level
// `company`, so they only get typed once.
const B = (t: BlockType, extra: Partial<Block> = {}): Block => ({ t, ...extra });
export interface Layout { id: string; name: string; blocks: () => Block[] }
export const LAYOUTS: Layout[] = [
  { id: "classic", name: "Classic newsletter", blocks: () => [B("banner"), B("hero", { image: "", heading: "This month at {company}", body: "A short welcome line to set the scene." }), B("heading", { heading: "What's on" }), B("text", { body: "Write your main update here — news, dates, and anything families should know." }), B("button", { label: "Book now" }), B("footer")] },
  { id: "announce", name: "Simple announcement", blocks: () => [B("banner"), B("heading", { heading: "An update for our families" }), B("text", { body: "Your announcement goes here." }), B("footer")] },
  { id: "event", name: "Event invite", blocks: () => [B("banner"), B("hero", { heading: "You're invited!", body: "Join us for a special day." }), B("eventbar", { date: "", time: "", location: "" }), B("text", { body: "Tell families what to expect and what to bring." }), B("button", { label: "Let us know you're coming" }), B("footer")] },
  { id: "offer", name: "Offer / discount", blocks: () => [B("banner"), B("heading", { heading: "A treat for our families" }), B("discount", { code: "SUMMER10", codeDesc: "10% off your next booking — this week only." }), B("text", { body: "How to use it and when it ends." }), B("button", { label: "Book & save" }), B("footer")] },
  { id: "twocol", name: "Two columns", blocks: () => [B("banner"), B("hero", { image: "", heading: "News in brief" }), B("columns", { left: "First thing families should know.", right: "Second thing families should know." }), B("button", { label: "Read more" }), B("footer")] },
  { id: "photostory", name: "Photo story", blocks: () => [B("banner"), B("image", { image: "" }), B("heading", { heading: "A brilliant week" }), B("text", { body: "A few words about what the children got up to." }), B("image", { image: "" }), B("footer")] },
  { id: "welcome", name: "Welcome pack", blocks: () => [B("banner"), B("hero", { heading: "Welcome to {company}!", body: "We're so pleased to have you with us." }), B("text", { body: "Everything you need for your first day." }), B("columns", { left: "What to bring", right: "Drop-off & pick-up" }), B("footer")] },
  { id: "roundup", name: "Monthly round-up", blocks: () => [B("banner"), B("heading", { heading: "This month's round-up" }), B("text", { body: "Highlight one." }), B("divider"), B("text", { body: "Highlight two." }), B("divider"), B("text", { body: "Highlight three." }), B("footer")] },
  { id: "bigcta", name: "Big image + button", blocks: () => [B("hero", { image: "", heading: "Summer camp is open" }), B("heading", { heading: "Spaces are limited" }), B("button", { label: "Book your place" }), B("footer")] },
  { id: "quote", name: "Shout-out & quote", blocks: () => [B("banner"), B("heading", { heading: "Star of the month" }), B("quote", { body: "A lovely thing to celebrate.", heading: "— the team" }), B("text", { body: "A few more words." }), B("footer")] },
];
export const layoutOf = (id: string) => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];

export const newNewsletter = (layoutId: string, company: Partial<Company> = {}): Newsletter => ({
  layout: layoutId, palette: ALL_PALETTES[0].id,
  company: { name: company.name ?? "", phone: company.phone ?? "", email: company.email ?? "", address: company.address ?? "", logo: company.logo },
  blocks: layoutOf(layoutId).blocks(),
});

const fill = (s: string | undefined, company: Company) => (s ?? "").replace(/\{company\}/g, company.name || "us");

// A plain-text rendering of the newsletter — used to hand it to the Email area
// ready to send to parents (the email channel is plain text today).
export function newsletterToText(nl: Newsletter): string {
  const c = nl.company;
  const f = (s?: string) => fill(s, c);
  const out: string[] = [];
  for (const b of nl.blocks) {
    if (b.t === "banner") { if (c.name) out.push(c.name.toUpperCase(), ""); continue; }
    if (b.t === "footer") { out.push("—"); if (c.name) out.push(c.name); if (c.address) out.push(c.address); const cc = [c.phone, c.email].filter(Boolean).join(" · "); if (cc) out.push(cc); continue; }
    if (b.t === "divider") { out.push("———"); continue; }
    if (b.heading) out.push(f(b.heading));
    if (b.body) out.push(f(b.body));
    if (b.left) out.push(f(b.left));
    if (b.right) out.push(f(b.right));
    if (b.t === "discount" && b.code) out.push(`Code: ${b.code}${b.codeDesc ? ` — ${f(b.codeDesc)}` : ""}`);
    if (b.t === "eventbar") { const e = [b.date, b.time, b.location].filter(Boolean).join(" · "); if (e) out.push(e); }
    if (b.t === "button" && b.label) out.push(`${b.label}${b.url ? `: ${b.url}` : ""}`);
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Renderer — draws the newsletter from blocks + palette. Used in preview and
// both feeds.
export function NewsletterView({ data, scale }: { data: Newsletter; scale?: number }) {
  const p = paletteOf(data.palette);
  const c = data.company;
  const wrap: CSSProperties = { background: p.bg, padding: 14, borderRadius: 16 };
  const surface: CSSProperties = { background: p.surface, borderRadius: 12, overflow: "hidden", maxWidth: 600, margin: "0 auto", boxShadow: "0 8px 26px -14px rgba(0,0,0,.28)" };
  return (
    <div style={wrap}>
      <div style={surface}>
        {data.blocks.map((b, i) => <BlockView key={i} b={b} p={p} c={c} />)}
      </div>
      {scale ? null : null}
    </div>
  );
}

function BlockView({ b, p, c }: { b: Block; p: Palette; c: Company }) {
  const pad = "22px 26px";
  switch (b.t) {
    case "banner":
      return (
        <div style={{ background: p.accent, color: p.onAccent, padding: "16px 26px", display: "flex", alignItems: "center", gap: 12 }}>
          {c.logo ? <img src={c.logo} alt="" style={{ height: 34, width: 34, borderRadius: 8, objectFit: "cover", background: "#fff" }} /> : <div style={{ height: 34, width: 34, borderRadius: 8, background: p.accent2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{(c.name || "A").slice(0, 1)}</div>}
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: .2 }}>{c.name || "Your company"}</div>
        </div>
      );
    case "hero":
      return (
        <div>
          {b.image ? <img src={b.image} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} /> : <div style={{ height: 120, background: `linear-gradient(120deg, ${p.accent}, ${p.accent2})` }} />}
          {(b.heading || b.body) && (
            <div style={{ padding: pad, background: p.band }}>
              {b.heading && <div style={{ fontSize: 24, fontWeight: 800, color: p.ink, lineHeight: 1.15 }}>{fill(b.heading, c)}</div>}
              {b.body && <div style={{ fontSize: 14, color: p.muted, marginTop: 6, lineHeight: 1.55 }}>{fill(b.body, c)}</div>}
            </div>
          )}
        </div>
      );
    case "heading":
      return <div style={{ padding: "18px 26px 0" }}><div style={{ fontSize: 19, fontWeight: 800, color: p.ink }}>{fill(b.heading, c)}</div><div style={{ height: 3, width: 42, background: p.accent2, borderRadius: 3, marginTop: 8 }} /></div>;
    case "text":
      return <div style={{ padding: "12px 26px", fontSize: 14, color: p.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{fill(b.body, c)}</div>;
    case "image":
      return b.image ? <img src={b.image} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} /> : <div style={{ height: 150, margin: "12px 26px", borderRadius: 10, background: p.band, display: "flex", alignItems: "center", justifyContent: "center", color: p.muted, fontSize: 12, fontWeight: 700 }}>Image</div>;
    case "discount":
      return (
        <div style={{ padding: "14px 26px" }}>
          <div style={{ border: `2px dashed ${p.accent}`, borderRadius: 12, padding: "14px 16px", textAlign: "center", background: p.band }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: p.muted, textTransform: "uppercase" }}>Your code</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: p.accent, letterSpacing: 2, margin: "2px 0 4px" }}>{b.code || "CODE"}</div>
            <div style={{ fontSize: 13, color: p.ink }}>{fill(b.codeDesc, c)}</div>
          </div>
        </div>
      );
    case "button":
      return <div style={{ padding: "14px 26px", textAlign: "center" }}><span style={{ display: "inline-block", background: p.accent, color: p.onAccent, fontWeight: 800, fontSize: 14, padding: "11px 22px", borderRadius: 999 }}>{b.label || "Learn more"}</span></div>;
    case "columns":
      return (
        <div style={{ padding: "12px 26px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[b.left, b.right].map((t, i) => <div key={i} style={{ background: p.band, borderRadius: 10, padding: 14, fontSize: 13.5, color: p.ink, lineHeight: 1.5 }}>{fill(t, c)}</div>)}
        </div>
      );
    case "quote":
      return <div style={{ padding: "16px 26px" }}><div style={{ borderLeft: `4px solid ${p.accent2}`, paddingLeft: 14, fontSize: 17, fontStyle: "italic", color: p.ink, lineHeight: 1.5 }}>“{fill(b.body, c)}”</div>{b.heading && <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: p.muted }}>{b.heading}</div>}</div>;
    case "divider":
      return <div style={{ height: 1, background: p.band, margin: "6px 26px" }} />;
    case "eventbar":
      return <div style={{ margin: "12px 26px", background: p.accent, color: p.onAccent, borderRadius: 10, padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 16, fontWeight: 700, fontSize: 14 }}>{[b.date, b.time, b.location].filter(Boolean).join("   •   ") || "Add a date, time & place"}</div>;
    case "footer":
      return (
        <div style={{ background: p.ink, color: "#fff", padding: "18px 26px", fontSize: 12.5, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{c.name || "Your company"}</div>
          {c.address && <div style={{ opacity: .85 }}>{c.address}</div>}
          <div style={{ opacity: .85 }}>{[c.phone, c.email].filter(Boolean).join("  ·  ")}</div>
        </div>
      );
    default:
      return null;
  }
}

// ── Builder — layout gallery, palette swatches, company details, per-block
// editors, live preview. Calls onSave with the finished Newsletter.
export function NewsletterBuilder({ initial, initialCompany, initialMeta, listings = [], folders = [], onCancel, onSave }: { initial?: Newsletter; initialCompany?: Partial<Company>; initialMeta?: NlMeta; listings?: { id: string; title: string }[]; folders?: string[]; onCancel: () => void; onSave: (n: Newsletter, meta: NlMeta, channel: "page" | "email") => void }) {
  const [nl, setNl] = useState<Newsletter>(initial ?? newNewsletter("classic", initialCompany));
  const [meta, setMeta] = useState<NlMeta>(initialMeta ?? newMeta());
  const setM = (f: Partial<NlMeta>) => setMeta((m) => ({ ...m, ...f }));
  const [busy, setBusy] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const p = paletteOf(nl.palette);
  const setBlock = (i: number, f: Partial<Block>) => setNl((n) => ({ ...n, blocks: n.blocks.map((b, j) => (j === i ? { ...b, ...f } : b)) }));
  const setCompany = (f: Partial<Company>) => setNl((n) => ({ ...n, company: { ...n.company, ...f } }));
  const pickLayout = (id: string) => setNl((n) => ({ ...newNewsletter(id, n.company), palette: n.palette }));

  // One-click: describe the newsletter, and the AI fills every text section.
  async function writeAll() {
    if (!aiBrief.trim()) { setAiErr("Tell the AI what the newsletter is about first."); return; }
    setAiBusy(true); setAiErr("");
    const wanted = new Set<BlockType>(["hero", "heading", "text", "columns", "quote", "discount"]);
    const blocks = nl.blocks.map((b, i) => ({ i, t: b.t })).filter((x) => wanted.has(x.t));
    try {
      const r = await apiPost<{ blocks: Record<string, Record<string, string>> }>("/api/ai/compose-newsletter", { brief: aiBrief.trim(), company: nl.company.name || undefined, blocks });
      const allow = ["heading", "body", "left", "right", "code", "codeDesc"] as const;
      setNl((n) => ({ ...n, blocks: n.blocks.map((b, i) => { const f = r.blocks?.[String(i)]; if (!f) return b; const upd: Partial<Block> = {}; for (const k of allow) if (typeof f[k] === "string") upd[k] = f[k]; return { ...b, ...upd }; }) }));
    } catch (e) { setAiErr(e instanceof Error ? e.message : "Couldn’t write it — try again."); }
    finally { setAiBusy(false); }
  }

  async function upload(file: File, apply: (url: string) => void) {
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
      const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl });
      apply(url);
    } catch { /* ignore — keep whatever was there */ } finally { setBusy(false); }
  }
  const inputCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]";
  const imgBtn = (apply: (url: string) => void) => (
    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">
      {busy ? "Uploading…" : "Upload image"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, apply); }} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-[3vh]" onClick={onCancel}>
      <div className="flex w-full max-w-[960px] flex-col overflow-hidden rounded-3xl bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "94vh" }}>
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f,#3f78d8)" }}>
          <div className="text-[16px] font-extrabold">Design a newsletter</div>
          <button type="button" onClick={onCancel} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold">×</button>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_420px]">
          {/* Editor */}
          <div className="space-y-3 overflow-y-auto border-r border-[var(--line)] p-4">
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Newsletter name</div>
              <input value={meta.name} onChange={(e) => setM({ name: e.target.value })} placeholder="e.g. July Family Update" className={inputCls} />
            </div>
            <div className="rounded-xl border border-[#dbe6fb] bg-[#f4f8ff] p-2.5">
              <div className="mb-1 text-[11.5px] font-extrabold text-[#1d3a8f]">✨ Let AI write it for you</div>
              <textarea value={aiBrief} onChange={(e) => setAiBrief(e.target.value)} rows={2} placeholder="Describe your newsletter — e.g. “July update: Sports Day Fri 25th 10am on the main field, summer camp now open (early-bird ends Sunday), reminder to bring sun cream.”" className={inputCls} />
              <div className="mt-1.5 flex items-center gap-2">
                <button type="button" onClick={writeAll} disabled={aiBusy} className="rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-60">{aiBusy ? "Writing…" : "Write it all"}</button>
                <span className="text-[11px] text-[var(--ink-3)]">Fills every text section — tweak anything after.</span>
              </div>
              {aiErr && <div className="mt-1 text-[11px] font-bold text-[#c02636]">{aiErr}</div>}
            </div>
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Layout</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {LAYOUTS.map((l) => <button key={l.id} type="button" onClick={() => pickLayout(l.id)} className="rounded-lg border p-1.5 text-[10px] font-bold leading-tight" style={nl.layout === l.id ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{l.name}</button>)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Your details</div>
              <div className="grid grid-cols-2 gap-1.5">
                <input value={nl.company.name} onChange={(e) => setCompany({ name: e.target.value })} placeholder="Company name" className={inputCls} />
                <input value={nl.company.phone} onChange={(e) => setCompany({ phone: e.target.value })} placeholder="Phone" className={inputCls} />
                <input value={nl.company.email} onChange={(e) => setCompany({ email: e.target.value })} placeholder="Email" className={inputCls} />
                <input value={nl.company.address} onChange={(e) => setCompany({ address: e.target.value })} placeholder="Address" className={inputCls} />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {nl.company.logo && <img src={nl.company.logo} alt="" className="h-7 w-7 rounded object-cover" />}
                {imgBtn((url) => setCompany({ logo: url }))}
                <span className="text-[11px] text-[var(--ink-3)]">Logo (optional)</span>
              </div>
            </div>

            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Content</div>
              <div className="space-y-2">
                {nl.blocks.map((b, i) => {
                  const has = (k: keyof Block) => b[k] !== undefined;
                  if (b.t === "banner" || b.t === "footer" || b.t === "divider") return null;
                  return (
                    <div key={i} className="rounded-lg border border-[var(--line)] p-2">
                      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: p.accent }}>{b.t}</div>
                      <div className="space-y-1.5">
                        {(b.t === "hero" || b.t === "image") && (b.image ? <div className="flex items-center gap-2"><img src={b.image} alt="" className="h-10 w-16 rounded object-cover" /><button type="button" onClick={() => setBlock(i, { image: "" })} className="text-[11px] font-bold text-[#c02636]">Remove</button></div> : imgBtn((url) => setBlock(i, { image: url })))}
                        {has("heading") && <input value={b.heading ?? ""} onChange={(e) => setBlock(i, { heading: e.target.value })} placeholder="Heading" className={inputCls} />}
                        {has("body") && <textarea value={b.body ?? ""} onChange={(e) => setBlock(i, { body: e.target.value })} rows={2} placeholder="Text" className={inputCls} />}
                        {b.t === "columns" && <><input value={b.left ?? ""} onChange={(e) => setBlock(i, { left: e.target.value })} placeholder="Left column" className={inputCls} /><input value={b.right ?? ""} onChange={(e) => setBlock(i, { right: e.target.value })} placeholder="Right column" className={inputCls} /></>}
                        {b.t === "discount" && <div className="grid grid-cols-2 gap-1.5"><input value={b.code ?? ""} onChange={(e) => setBlock(i, { code: e.target.value.toUpperCase() })} placeholder="CODE" className={inputCls} /><input value={b.codeDesc ?? ""} onChange={(e) => setBlock(i, { codeDesc: e.target.value })} placeholder="What it gives" className={inputCls} /></div>}
                        {b.t === "button" && <div className="grid grid-cols-2 gap-1.5"><input value={b.label ?? ""} onChange={(e) => setBlock(i, { label: e.target.value })} placeholder="Button label" className={inputCls} /><input value={b.url ?? ""} onChange={(e) => setBlock(i, { url: e.target.value })} placeholder="Link (https://… — optional)" className={inputCls} /></div>}
                        {b.t === "eventbar" && <div className="grid grid-cols-3 gap-1.5"><input type="date" value={b.date ?? ""} onChange={(e) => setBlock(i, { date: e.target.value })} className={inputCls} /><input type="time" value={b.time ?? ""} onChange={(e) => setBlock(i, { time: e.target.value })} className={inputCls} /><input value={b.location ?? ""} onChange={(e) => setBlock(i, { location: e.target.value })} placeholder="Place" className={inputCls} /></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Publish</div>
              <div className="space-y-2 rounded-xl border border-[var(--line)] p-2.5">
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[var(--ink-3)]">Folder</div>
                  <input list="nl-folders" value={meta.folder} onChange={(e) => setM({ folder: e.target.value })} placeholder="Unfiled — type a new folder or pick one" className={inputCls} />
                  <datalist id="nl-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
                </div>
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[var(--ink-3)]">Who sees it</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {([["all", "All families"], ["listing", "One listing’s families"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => setM({ audScope: k, audId: "" })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={meta.audScope === k ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
                    {meta.audScope === "listing" && <select value={meta.audId} onChange={(e) => setM({ audId: e.target.value })} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[12px] outline-none"><option value="">Choose a listing…</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([["pinned", "Pin to top"], ["ackRequired", "Ask to acknowledge"], ["react", "Allow reactions"]] as const).map(([f, label]) => <button key={f} type="button" onClick={() => setM({ [f]: !meta[f] } as Partial<NlMeta>)} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={meta[f] ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{meta[f] ? "✓ " : ""}{label}</button>)}
                  <button type="button" onClick={() => setM({ priority: meta.priority === "urgent" ? "normal" : "urgent" })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={meta.priority === "urgent" ? { borderColor: "#c02636", background: "#fde2e4", color: "#c02636" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{meta.priority === "urgent" ? "✓ " : ""}High priority</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {([["now", "Publish now"], ["later", "Schedule"], ["draft", "Save as draft"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => setM({ when: k })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={meta.when === k ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
                  {meta.when === "later" && <input type="datetime-local" value={meta.publishAt} onChange={(e) => setM({ publishAt: e.target.value })} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[12px] outline-none" />}
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="overflow-y-auto bg-[var(--panel)] p-3">
            <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Preview</div>
            <NewsletterView data={nl} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button>
          <span className="mr-auto text-[11px] text-[var(--ink-3)]">Choose where it goes →</span>
          <button type="button" onClick={() => onSave(nl, meta, "email")} className="rounded-lg border border-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">✉ Email to parents</button>
          <button type="button" onClick={() => onSave(nl, meta, "page")} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-extrabold text-white">{meta.when === "draft" ? "Save to library" : meta.when === "later" ? "Schedule on Newsfeed" : "Post to Newsfeed"}</button>
        </div>
      </div>
    </div>
  );
}
