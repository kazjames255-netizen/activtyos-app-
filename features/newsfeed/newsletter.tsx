"use client";
/* eslint-disable @next/next/no-img-element -- newsletter images are arbitrary operator-uploaded URLs (and data previews); next/image doesn't fit. */

import { useRef, useState, type CSSProperties, type PointerEvent as RPE } from "react";
import { post as apiPost } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────
// Newsletter builder — a rich, email-style post. The operator picks one of ten
// LAYOUTS (an ordered set of blocks with seeded content) and one of a set of
// curated PALETTES (multi-colour schemes, not a single flat colour), then edits
// each slot. NewsletterView renders the result the same way in the composer
// preview, the operator feed and the parent feed.
// ─────────────────────────────────────────────────────────────────────────

export type BlockType = "banner" | "hero" | "heading" | "text" | "image" | "imageSmall" | "discount" | "button" | "columns" | "quote" | "divider" | "eventbar" | "footer";
export interface Block {
  t: BlockType;
  heading?: string; body?: string; image?: string;
  ix?: number; iy?: number; iz?: number; // image crop: pan x/y (% of frame) + zoom
  code?: string; codeDesc?: string;
  label?: string; url?: string; listingId?: string; listingTitle?: string;
  left?: string; right?: string;
  date?: string; time?: string; location?: string;
}
export interface Company { name: string; phone: string; email: string; address: string; logo?: string }
export interface Newsletter { layout: string; palette: string; company: Company; blocks: Block[] }

// Publishing metadata for a newsletter — how it's named, filed and sent. Kept
// alongside the Newsletter design so the builder owns the whole flow.
export interface NlMeta { name: string; folder: string; audScope: "all" | "listing"; audIds: string[]; pinned: boolean; ackRequired: boolean; react: boolean; priority: "normal" | "urgent"; when: "now" | "later" | "draft"; publishAt: string }
export const newMeta = (): NlMeta => ({ name: "", folder: "", audScope: "all", audIds: [], pinned: false, ackRequired: false, react: true, priority: "normal", when: "now", publishAt: "" });

// ── Curated palettes — each carries a background, a card surface, two accents,
// ink + muted text and the colour text sits on over an accent. Deliberately
// multi-hue so a newsletter reads as designed, not flat.
export interface Palette { id: string; name: string; bg: string; surface: string; accent: string; accent2: string; ink: string; muted: string; onAccent: string; band: string }

// Simple, single-colour themes — pick one bright popular colour and the whole
// newsletter (header banner, buttons, event bar, footer) uses it. Neutrals are
// derived from the colour so it stays clean, not multi-hue.
const NL_COLOURS: [string, string, string][] = [ // [id, name, hex]
  ["blue", "Blue", "#2563eb"], ["sky", "Sky", "#0284c7"], ["teal", "Teal", "#0d9488"], ["green", "Green", "#16a34a"], ["lime", "Lime", "#4d7c0f"],
  ["amber", "Amber", "#d97706"], ["orange", "Orange", "#ea580c"], ["red", "Red", "#dc2626"], ["pink", "Pink", "#db2777"], ["purple", "Purple", "#7c3aed"],
];
const mkC = (id: string, name: string, hex: string): Palette => ({ id, name, bg: `${hex}10`, surface: "#ffffff", accent: hex, accent2: hex, ink: "#1b2130", muted: "#5f6672", onAccent: "#ffffff", band: `${hex}1a` });
export const NL_PALETTES: Palette[] = NL_COLOURS.map(([id, name, hex]) => mkC(id, name, hex));
export const paletteOf = (id: string) => NL_PALETTES.find((p) => p.id === id) ?? NL_PALETTES[0];

// ── 10 layouts: each seeds a block list. Company details flow from the top-level
// `company`, so they only get typed once.
const B = (t: BlockType, extra: Partial<Block> = {}): Block => ({ t, ...extra });
export interface Layout { id: string; name: string; blocks: () => Block[] }
export const LAYOUTS: Layout[] = [
  { id: "classic", name: "Classic newsletter", blocks: () => [B("banner"), B("hero", { image: "", heading: "This month at {company}", body: "A short welcome line to set the scene." }), B("heading", { heading: "What's on" }), B("text", { body: "Write your main update here — news, dates, and anything families should know." }), B("imageSmall", { image: "" }), B("button", { label: "Book now" }), B("footer")] },
  { id: "announce", name: "Simple announcement", blocks: () => [B("banner"), B("heading", { heading: "An update for our families" }), B("text", { body: "Your announcement goes here." }), B("footer")] },
  { id: "event", name: "Event invite", blocks: () => [B("banner"), B("hero", { heading: "You're invited!", body: "Join us for a special day." }), B("eventbar", { date: "", time: "", location: "" }), B("text", { body: "Tell families what to expect and what to bring." }), B("imageSmall", { image: "" }), B("button", { label: "Let us know you're coming" }), B("footer")] },
  { id: "offer", name: "Offer / discount", blocks: () => [B("banner"), B("heading", { heading: "A treat for our families" }), B("discount", { code: "SUMMER10", codeDesc: "10% off your next booking — this week only." }), B("text", { body: "How to use it and when it ends." }), B("imageSmall", { image: "" }), B("button", { label: "Book & save" }), B("footer")] },
  { id: "twocol", name: "Two columns", blocks: () => [B("banner"), B("hero", { image: "", heading: "News in brief" }), B("columns", { left: "First thing families should know.", right: "Second thing families should know." }), B("imageSmall", { image: "" }), B("button", { label: "Read more" }), B("footer")] },
  { id: "photostory", name: "Photo story", blocks: () => [B("banner"), B("image", { image: "" }), B("heading", { heading: "A brilliant week" }), B("text", { body: "A few words about what the children got up to." }), B("image", { image: "" }), B("footer")] },
  { id: "welcome", name: "Welcome pack", blocks: () => [B("banner"), B("hero", { heading: "Welcome to {company}!", body: "We're so pleased to have you with us." }), B("text", { body: "Everything you need for your first day." }), B("columns", { left: "What to bring", right: "Drop-off & pick-up" }), B("imageSmall", { image: "" }), B("footer")] },
  { id: "roundup", name: "Monthly round-up", blocks: () => [B("banner"), B("heading", { heading: "This month's round-up" }), B("text", { body: "Highlight one." }), B("divider"), B("text", { body: "Highlight two." }), B("divider"), B("text", { body: "Highlight three." }), B("footer")] },
  { id: "bigcta", name: "Big image + button", blocks: () => [B("hero", { image: "", heading: "Summer camp is open" }), B("heading", { heading: "Spaces are limited" }), B("button", { label: "Book your place" }), B("footer")] },
  { id: "quote", name: "Shout-out & quote", blocks: () => [B("banner"), B("heading", { heading: "Star of the month" }), B("quote", { body: "A lovely thing to celebrate.", heading: "— the team" }), B("text", { body: "A few more words." }), B("footer")] },
];
export const layoutOf = (id: string) => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];

export const newNewsletter = (layoutId: string, company: Partial<Company> = {}): Newsletter => ({
  layout: layoutId, palette: NL_PALETTES[0].id,
  company: { name: company.name ?? "", phone: company.phone ?? "", email: company.email ?? "", address: company.address ?? "", logo: company.logo },
  blocks: layoutOf(layoutId).blocks(),
});

const fill = (s: string | undefined, company: Company) => (s ?? "").replace(/\{company\}/g, company.name || "us");

// Shrink an image client-side (cap the longest edge, re-encode as JPEG) so big
// camera photos fit under the /api/uploads 2 MB limit and load fast.
export function downscaleImage(file: File, max = 1600): Promise<string> {
  const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn’t read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn’t look like an image."));
      img.onload = () => {
        let width = img.width, height = img.height;
        if (Math.max(width, height) > max) { const s = max / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); }
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Couldn’t process the image.")); return; }
        const draw = (w: number, h: number, q: number) => { canvas.width = w; canvas.height = h; ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h); return canvas.toDataURL("image/jpeg", q); };
        let quality = 0.85, out = draw(width, height, quality), guard = 0;
        // The route rejects images over ~900 KB decoded — keep re-encoding until it fits.
        while (bytesOf(out) > 850_000 && guard++ < 8) {
          if (quality > 0.5) quality -= 0.12; else { width = Math.round(width * 0.85); height = Math.round(height * 0.85); }
          out = draw(width, height, quality);
        }
        resolve(out);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// A post image. "full" shows the WHOLE picture (nothing cropped) — the default,
// so an uploaded photo is never cut. Any other aspect ("16/9" / "1/1" / "4/5")
// crops to that shape with pan (translate x/y in % of frame) + zoom, rendered
// identically in the composer, both feeds and the PDF.
export function PostImage({ url, aspect = "full", x = 0, y = 0, zoom = 1, rounded = true }: { url: string; aspect?: string; x?: number; y?: number; zoom?: number; rounded?: boolean }) {
  if (!aspect || aspect === "full") {
    return <div className="w-full text-center" style={{ background: "#f2f5fb" }}><img src={url} alt="" draggable={false} className={rounded ? "rounded-lg" : ""} style={{ display: "inline-block", maxWidth: "100%", maxHeight: 440, verticalAlign: "middle" }} /></div>;
  }
  return (
    <div className={`relative w-full overflow-hidden ${rounded ? "rounded-lg" : ""}`} style={{ aspectRatio: aspect.replace("/", " / "), background: "#0b1020" }}>
      <img src={url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${x}%, ${y}%) scale(${zoom})`, transformOrigin: "center" }} />
    </div>
  );
}

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

// Designed HTML of the newsletter (inline styles) — for the print-to-PDF window
// and, later, the HTML email. Mirrors BlockView.
export function newsletterToHtml(nl: Newsletter): string {
  const p = paletteOf(nl.palette);
  const c = nl.company;
  const e = (s?: string) => fill(s, c).replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] as string));
  const blocks = nl.blocks.map((b) => {
    switch (b.t) {
      case "banner": return `<div style="background:${p.accent};color:${p.onAccent};padding:16px 26px;font-weight:800;font-size:17px">${c.logo ? `<img src="${c.logo}" style="height:30px;vertical-align:middle;margin-right:10px;background:#fff;border-radius:6px" alt=""/>` : ""}${e(c.name) || "Your company"}</div>`;
      case "hero": return `${b.image ? `<div style="height:340px;overflow:hidden"><img src="${b.image}" style="width:100%;height:100%;object-fit:cover;display:block;transform:translate(${b.ix ?? 0}%, ${b.iy ?? 0}%) scale(${b.iz ?? 1});transform-origin:center" alt=""/></div>` : `<div style="height:220px;background:linear-gradient(120deg,${p.accent},${p.accent2})"></div>`}${(b.heading || b.body) ? `<div style="padding:22px 26px;background:${p.band}">${b.heading ? `<div style="font-size:24px;font-weight:800;color:${p.ink}">${e(b.heading)}</div>` : ""}${b.body ? `<div style="font-size:14px;color:${p.muted};margin-top:6px">${e(b.body)}</div>` : ""}</div>` : ""}`;
      case "heading": return `<div style="padding:18px 26px 0"><div style="font-size:19px;font-weight:800;color:${p.ink}">${e(b.heading)}</div><div style="height:3px;width:42px;background:${p.accent2};border-radius:3px;margin-top:8px"></div>${b.body ? `<div style="font-size:14px;color:${p.ink};line-height:1.6;white-space:pre-wrap;margin-top:10px">${e(b.body)}</div>` : ""}</div>`;
      case "text": return `<div style="padding:12px 26px;font-size:14px;color:${p.ink};line-height:1.6;white-space:pre-wrap">${e(b.body)}</div>`;
      case "image": return b.image ? `<div style="height:300px;overflow:hidden"><img src="${b.image}" style="width:100%;height:100%;object-fit:cover;display:block;transform:translate(${b.ix ?? 0}%, ${b.iy ?? 0}%) scale(${b.iz ?? 1});transform-origin:center" alt=""/></div>` : "";
      case "imageSmall": return b.image ? `<div style="padding:10px 26px;text-align:center"><div style="display:inline-block;width:56%;height:170px;overflow:hidden;border-radius:10px"><img src="${b.image}" style="width:100%;height:100%;object-fit:cover;display:block;transform:translate(${b.ix ?? 0}%, ${b.iy ?? 0}%) scale(${b.iz ?? 1});transform-origin:center" alt=""/></div></div>` : "";
      case "discount": return `<div style="padding:14px 26px"><div style="border:2px dashed ${p.accent};border-radius:12px;padding:14px 16px;text-align:center;background:${p.band}"><div style="font-size:12px;font-weight:800;letter-spacing:1px;color:${p.muted};text-transform:uppercase">Your code</div><div style="font-size:26px;font-weight:900;color:${p.accent};letter-spacing:2px">${e(b.code) || "CODE"}</div><div style="font-size:13px;color:${p.ink}">${e(b.codeDesc)}</div></div></div>`;
      case "button": { const bhref = b.listingId ? `/book/${b.listingId}` : (b.url || ""); const bs = `display:inline-block;background:${p.accent};color:${p.onAccent};font-weight:800;font-size:14px;padding:11px 22px;border-radius:999px;text-decoration:none`; return `<div style="padding:14px 26px;text-align:center">${bhref ? `<a href="${e(bhref)}" style="${bs}">` : `<span style="${bs}">`}${e(b.label) || "Learn more"}${bhref ? "</a>" : "</span>"}</div>`; }
      case "columns": return `<div style="padding:12px 26px;display:flex;gap:16px">${[b.left, b.right].map((t) => `<div style="flex:1;background:${p.band};border-radius:10px;padding:14px;font-size:13.5px;color:${p.ink}">${e(t)}</div>`).join("")}</div>`;
      case "quote": return `<div style="padding:16px 26px"><div style="border-left:4px solid ${p.accent2};padding-left:14px;font-size:17px;font-style:italic;color:${p.ink}">&ldquo;${e(b.body)}&rdquo;</div>${b.heading ? `<div style="margin-top:6px;font-size:13px;font-weight:700;color:${p.muted}">${e(b.heading)}</div>` : ""}</div>`;
      case "divider": return `<div style="height:1px;background:${p.band};margin:6px 26px"></div>`;
      case "eventbar": return `<div style="margin:12px 26px;background:${p.accent};color:${p.onAccent};border-radius:10px;padding:12px 16px;font-weight:700;font-size:14px">${e([b.date, b.time, b.location].filter(Boolean).join("   •   ")) || "Event details"}</div>`;
      case "footer": return `<div style="background:${p.accent};color:#fff;padding:18px 26px;font-size:12.5px;line-height:1.7"><div style="font-weight:800;font-size:14px">${e(c.name) || "Your company"}</div>${c.address ? `<div style="opacity:.85">${e(c.address)}</div>` : ""}<div style="opacity:.85">${e([c.phone, c.email].filter(Boolean).join("  ·  "))}</div></div>`;
      default: return "";
    }
  }).join("");
  return `<div style="background:${p.surface};max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 8px 26px -14px rgba(0,0,0,.28)">${blocks}</div>`;
}
// Open a print window (browser "Save as PDF") for the newsletter.
export function printNewsletter(nl: Newsletter) {
  const w = typeof window !== "undefined" ? window.open("", "_blank", "width=760,height=980") : null;
  if (!w) return;
  const title = (fill(nl.company.name, nl.company) || "Newsletter").replace(/[&<>]/g, "");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:8mm}html,body{margin:0}body{background:#fff;padding:0;font-family:system-ui,-apple-system,sans-serif}body>div{max-width:760px!important}</style></head><body>${newsletterToHtml(nl)}<script>window.onload=function(){window.focus();window.print();}</script></body></html>`);
  w.document.close();
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
          {c.logo && <img src={c.logo} alt="" style={{ height: 34, borderRadius: 6, objectFit: "contain", background: "#fff" }} />}
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: .2 }}>{c.name || "Your company"}</div>
        </div>
      );
    case "hero":
      return (
        <div>
          {b.image ? <div style={{ height: 340, overflow: "hidden" }}><img src={b.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: `translate(${b.ix ?? 0}%, ${b.iy ?? 0}%) scale(${b.iz ?? 1})`, transformOrigin: "center" }} /></div> : <div style={{ height: 220, background: `linear-gradient(120deg, ${p.accent}, ${p.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.85)", fontSize: 13, fontWeight: 700 }}>Add a big photo here</div>}
          {(b.heading || b.body) && (
            <div style={{ padding: pad, background: p.band }}>
              {b.heading && <div style={{ fontSize: 24, fontWeight: 800, color: p.ink, lineHeight: 1.15 }}>{fill(b.heading, c)}</div>}
              {b.body && <div style={{ fontSize: 14, color: p.muted, marginTop: 6, lineHeight: 1.55 }}>{fill(b.body, c)}</div>}
            </div>
          )}
        </div>
      );
    case "heading":
      return <div style={{ padding: "18px 26px 0" }}><div style={{ fontSize: 19, fontWeight: 800, color: p.ink }}>{fill(b.heading, c)}</div><div style={{ height: 3, width: 42, background: p.accent2, borderRadius: 3, marginTop: 8 }} />{b.body ? <div style={{ fontSize: 14, color: p.ink, lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 10 }}>{fill(b.body, c)}</div> : null}</div>;
    case "text":
      return <div style={{ padding: "12px 26px", fontSize: 14, color: p.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{fill(b.body, c)}</div>;
    case "image":
      return b.image ? <div style={{ height: 300, overflow: "hidden" }}><img src={b.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: `translate(${b.ix ?? 0}%, ${b.iy ?? 0}%) scale(${b.iz ?? 1})`, transformOrigin: "center" }} /></div> : <div style={{ height: 200, margin: "12px 26px", borderRadius: 10, background: p.band, display: "flex", alignItems: "center", justifyContent: "center", color: p.muted, fontSize: 12, fontWeight: 700 }}>Add a photo</div>;
    case "imageSmall":
      // Optional secondary photo, half the main image's size, centred. Renders
      // nothing at all when left empty, so it never disturbs the layout.
      return b.image ? <div style={{ padding: "10px 26px", textAlign: "center" }}><div style={{ display: "inline-block", width: "56%", height: 170, overflow: "hidden", borderRadius: 10 }}><img src={b.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: `translate(${b.ix ?? 0}%, ${b.iy ?? 0}%) scale(${b.iz ?? 1})`, transformOrigin: "center" }} /></div></div> : null;
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
    case "button": {
      const href = b.listingId ? `/book/${b.listingId}` : (b.url || "");
      const bStyle = { display: "inline-block", background: p.accent, color: p.onAccent, fontWeight: 800, fontSize: 14, padding: "11px 22px", borderRadius: 999, textDecoration: "none" } as CSSProperties;
      return <div style={{ padding: "14px 26px", textAlign: "center" }}>{href ? <a href={href} style={bStyle}>{b.label || "Learn more"}</a> : <span style={bStyle}>{b.label || "Learn more"}</span>}</div>;
    }
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
        <div style={{ background: p.accent, color: "#fff", padding: "18px 26px", fontSize: 12.5, lineHeight: 1.7 }}>
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
export function NewsletterBuilder({ initial, initialCompany, initialMeta, listings = [], coupons = [], folders = [], onCancel, onSave }: { initial?: Newsletter; initialCompany?: Partial<Company>; initialMeta?: NlMeta; listings?: { id: string; title: string }[]; coupons?: { code: string; desc: string }[]; folders?: string[]; onCancel: () => void; onSave: (n: Newsletter, meta: NlMeta, channel: "page" | "email" | "both") => void }) {
  const [nl, setNl] = useState<Newsletter>(initial ?? newNewsletter("classic", initialCompany));
  const [meta, setMeta] = useState<NlMeta>(initialMeta ?? newMeta());
  const setM = (f: Partial<NlMeta>) => setMeta((m) => ({ ...m, ...f }));
  const [busy, setBusy] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const p = paletteOf(nl.palette);
  const setBlock = (i: number, f: Partial<Block>) => setNl((n) => ({ ...n, blocks: n.blocks.map((b, j) => (j === i ? { ...b, ...f } : b)) }));
  // Duplicate a content box (insert a copy right after it) so operators can add
  // extra headings / paragraphs / images without picking a whole new layout.
  const dupBlock = (i: number) => setNl((n) => ({ ...n, blocks: [...n.blocks.slice(0, i + 1), { ...n.blocks[i] }, ...n.blocks.slice(i + 1)] }));
  const delBlock = (i: number) => setNl((n) => ({ ...n, blocks: n.blocks.filter((_, j) => j !== i) }));
  // Drag-to-move + zoom for a block's image (same crop model as posts).
  const bClampS = (v: number, z: number) => { const m = ((z - 1) / 2) * 100; return Math.max(-m, Math.min(m, v)); };
  const bDrag = useRef<{ i: number; sx: number; sy: number; x: number; y: number; w: number; h: number } | null>(null);
  const bDown = (i: number) => (e: RPE<HTMLDivElement>) => { bDrag.current = { i, sx: e.clientX, sy: e.clientY, x: nl.blocks[i].ix ?? 0, y: nl.blocks[i].iy ?? 0, w: e.currentTarget.clientWidth || 1, h: e.currentTarget.clientHeight || 1 }; e.currentTarget.setPointerCapture(e.pointerId); };
  const bMove = (e: RPE<HTMLDivElement>) => { const d = bDrag.current; if (!d) return; const z = nl.blocks[d.i].iz ?? 1; setBlock(d.i, { ix: bClampS(d.x + ((e.clientX - d.sx) / d.w) * 100, z), iy: bClampS(d.y + ((e.clientY - d.sy) / d.h) * 100, z) }); };
  const bUp = () => { bDrag.current = null; };
  const bZoom = (i: number, z: number) => setBlock(i, { iz: z, ix: bClampS(nl.blocks[i].ix ?? 0, z), iy: bClampS(nl.blocks[i].iy ?? 0, z) });
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
      const dataUrl = await downscaleImage(file);
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
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Colour</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {NL_PALETTES.map((pl) => <button key={pl.id} type="button" title={pl.name} onClick={() => setNl((n) => ({ ...n, palette: pl.id }))} className="h-7 w-7 rounded-full" style={{ background: pl.accent, boxShadow: nl.palette === pl.id ? "0 0 0 2px #fff, 0 0 0 4px #111" : "none" }} />)}
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
                {nl.company.logo ? <button type="button" onClick={() => setCompany({ logo: undefined })} className="text-[11px] font-bold text-[#c02636]">Remove</button> : <span className="text-[11px] text-[var(--ink-3)]">Logo (optional)</span>}
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
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: p.accent }}>{b.t === "imageSmall" ? "Extra photo (optional)" : b.t}</span>
                        <span className="flex items-center gap-2">
                          <button type="button" onClick={() => dupBlock(i)} className="text-[11px] font-bold text-[var(--ink-2)] hover:text-[#1d3a8f]">Duplicate</button>
                          <button type="button" onClick={() => delBlock(i)} className="text-[11px] font-bold text-[#c02636]">Remove</button>
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {(b.t === "hero" || b.t === "image" || b.t === "imageSmall") && (b.image ? (
                          <div>
                            <div className="cursor-move touch-none select-none overflow-hidden rounded" style={{ aspectRatio: b.t === "hero" ? "600 / 340" : b.t === "imageSmall" ? "336 / 170" : "600 / 300", background: "#0b1020" }} onPointerDown={bDown(i)} onPointerMove={bMove} onPointerUp={bUp} onPointerCancel={bUp}>
                              <img src={b.image} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${b.ix ?? 0}%, ${b.iy ?? 0}%) scale(${b.iz ?? 1})`, transformOrigin: "center" }} />
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[10.5px] font-bold text-[var(--ink-3)]">Zoom</span>
                              <input type="range" min={1} max={4} step={0.02} value={b.iz ?? 1} onChange={(e) => bZoom(i, parseFloat(e.target.value))} className="h-1 flex-1 accent-[#1d3a8f]" />
                              {imgBtn((url) => setBlock(i, { image: url, ix: 0, iy: 0, iz: 1 }))}
                              <button type="button" onClick={() => setBlock(i, { image: "", ix: 0, iy: 0, iz: 1 })} className="text-[11px] font-bold text-[#c02636]">Remove</button>
                            </div>
                            <div className="text-[10px] text-[var(--ink-3)]">Drag to move · zoom to crop.</div>
                          </div>
                        ) : <div className="flex items-center gap-2">{imgBtn((url) => setBlock(i, { image: url }))}{b.t === "imageSmall" && <span className="text-[10.5px] text-[var(--ink-3)]">Optional — a smaller second photo. Leave empty and it won’t show.</span>}</div>)}
                        {has("heading") && <input value={b.heading ?? ""} onChange={(e) => setBlock(i, { heading: e.target.value })} placeholder="Heading" className={inputCls} />}
                        {(has("body") || b.t === "heading") && <textarea value={b.body ?? ""} onChange={(e) => setBlock(i, { body: e.target.value })} rows={2} placeholder={b.t === "heading" ? "Text under this heading (optional)" : "Text"} className={inputCls} />}
                        {b.t === "columns" && <><input value={b.left ?? ""} onChange={(e) => setBlock(i, { left: e.target.value })} placeholder="Left column" className={inputCls} /><input value={b.right ?? ""} onChange={(e) => setBlock(i, { right: e.target.value })} placeholder="Right column" className={inputCls} /></>}
                        {b.t === "discount" && <div className="grid gap-1.5">{coupons.length > 0 && <select value={coupons.some((c) => c.code === b.code) ? b.code : ""} onChange={(e) => { const c = coupons.find((x) => x.code === e.target.value); if (c) setBlock(i, { code: c.code, codeDesc: c.desc }); }} className={inputCls}><option value="">Pull in a discount code…</option>{coupons.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>)}</select>}<div className="grid grid-cols-2 gap-1.5"><input value={b.code ?? ""} onChange={(e) => setBlock(i, { code: e.target.value.toUpperCase() })} placeholder="CODE" className={inputCls} /><input value={b.codeDesc ?? ""} onChange={(e) => setBlock(i, { codeDesc: e.target.value })} placeholder="What it gives" className={inputCls} /></div></div>}
                        {b.t === "button" && (() => { const kind = b.url ? "url" : "listing"; return (
                          <div className="space-y-1.5">
                            <input value={b.label ?? ""} onChange={(e) => setBlock(i, { label: e.target.value })} placeholder="Button label (e.g. Book now)" className={inputCls} />
                            <div className="flex flex-wrap gap-1.5">
                              {([["listing", "To a listing"], ["url", "To a web link"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => (k === "listing" ? setBlock(i, { url: "" }) : setBlock(i, { listingId: "", listingTitle: "" }))} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={kind === k ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
                            </div>
                            {kind === "listing"
                              ? <select value={b.listingId ?? ""} onChange={(e) => { const l = listings.find((x) => x.id === e.target.value); setBlock(i, { listingId: e.target.value, listingTitle: l?.title ?? "", url: "" }); }} className={inputCls}><option value="">Choose a listing…</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
                              : <input value={b.url ?? ""} onChange={(e) => setBlock(i, { url: e.target.value, listingId: "", listingTitle: "" })} placeholder="https://…" className={inputCls} />}
                          </div>
                        ); })()}
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
                    {([["all", "All families"], ["listing", "Chosen listings’ families"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => setM({ audScope: k, audIds: [] })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={meta.audScope === k ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
                  </div>
                  {meta.audScope === "listing" && <div className="mt-1.5 flex flex-wrap gap-1.5">{listings.length === 0 ? <span className="text-[11px] text-[var(--ink-3)]">No listings yet.</span> : listings.map((l) => { const on = meta.audIds.includes(l.id); return <button key={l.id} type="button" onClick={() => setM({ audIds: on ? meta.audIds.filter((x) => x !== l.id) : [...meta.audIds, l.id] })} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={on ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{l.title}</button>; })}</div>}
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
            <div className="mt-2 flex justify-center"><span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)]">💬 Message us for more info</span></div>
            <div className="mt-1 text-center text-[10px] text-[var(--ink-3)]">Families get a “Message us” button on every post — opens a message to you, subject pre-filled.</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button>
          <span className="mr-auto text-[11px] text-[var(--ink-3)]">Choose where it goes →</span>
          <span className="mr-auto text-[11px] text-[var(--ink-3)]">Do one now — reopen to do another</span>
          <button type="button" onClick={() => printNewsletter(nl)} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">⬇ PDF</button>
          <button type="button" onClick={() => onSave(nl, meta, "email")} className="rounded-lg border border-[#1d3a8f] px-3 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">✉ Email</button>
          <button type="button" onClick={() => onSave(nl, meta, "page")} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-extrabold text-white">{meta.when === "draft" ? "Save to library" : meta.when === "later" ? "Schedule" : "Post to Newsfeed"}</button>
        </div>
      </div>
    </div>
  );
}
