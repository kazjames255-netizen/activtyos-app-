"use client";
/* eslint-disable @next/next/no-img-element -- campaign images are arbitrary operator-uploaded URLs; next/image doesn't fit inline-styled email HTML. */

// ─────────────────────────────────────────────────────────────────────────
// Campaign email templates — 30 beautiful, provider-focused designs built on
// 15 reusable layout structures. Everything is TABLE-BASED, inline-styled and
// absolute-free (email-safe), and every text colour is DERIVED from the
// background it sits on via a per-accent theme, so recolouring can never make
// text disappear. Some templates deliberately have no button.
// ─────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { post as apiPost } from "@/lib/api";
import { downscaleImage, type Company } from "@/features/newsfeed/newsletter";

export interface TplFields {
  brand?: string;
  heroImage?: string; image2?: string; image3?: string;
  heading?: string; subheading?: string; body?: string;
  ctaLabel?: string; ctaUrl?: string;
  sectionTitle?: string; sectionBody?: string; badge?: string;
  item1?: string; item2?: string; item3?: string; item4?: string; item5?: string; item6?: string;
  footerPhone?: string; footerEmail?: string; footerWeb?: string; footerAddress?: string;
}
export interface CampaignDesign { templateId: string; accent: string; fields: TplFields }

export const TPL_ACCENTS: { id: string; name: string; hex: string }[] = [
  { id: "blue", name: "Blue", hex: "#2f6bd8" }, { id: "navy", name: "Navy", hex: "#1b3a8f" },
  { id: "teal", name: "Teal", hex: "#188f83" }, { id: "green", name: "Green", hex: "#2c9a52" },
  { id: "mint", name: "Mint", hex: "#3bbf9a" }, { id: "amber", name: "Amber", hex: "#e08a1e" },
  { id: "coral", name: "Coral", hex: "#e2694e" }, { id: "red", name: "Red", hex: "#d33d4a" },
  { id: "pink", name: "Pink", hex: "#d83f86" }, { id: "purple", name: "Purple", hex: "#6d54cf" },
];

// ── colour maths ────────────────────────────────────────────────────────
const esc = (s?: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const shade = (hex: string, amt: number) => { const n = parseInt(hex.slice(1), 16); const r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt)); return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`; };
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const readable = (hex: string) => (lum(hex) > 155 ? "#101a2e" : "#ffffff");
const mutedOn = (hex: string) => (readable(hex) === "#ffffff" ? "rgba(255,255,255,.82)" : "rgba(16,26,46,.60)");

export interface Theme { a: string; aDark: string; aDeep: string; aSoft: string; onA: string; onAMut: string; onDark: string; onDarkMut: string; onDeep: string; ink: string; mut: string; line: string; cardAlt: string }
const theme = (hex: string): Theme => { const a = hex, aDark = shade(hex, -46), aDeep = shade(hex, -74); return { a, aDark, aDeep, aSoft: hex + "1f", onA: readable(a), onAMut: mutedOn(a), onDark: readable(aDark), onDarkMut: mutedOn(aDark), onDeep: readable(aDeep), ink: "#12203a", mut: "#5b6472", line: "#e6ebf2", cardAlt: "#f4f6f8" }; };

// ── html helpers ───────────────────────────────────────────────────────
const para = (s: string | undefined, style: string) => (s ?? "").split(/\n{2,}/).filter(Boolean).map((p) => `<p style="${style}">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const img = (url: string | undefined, h: string, radius = "0", ph = "#c9d3e2") => (url ? `<img src="${esc(url)}" alt="" width="100%" style="display:block;width:100%;height:${h};object-fit:cover;border-radius:${radius}">` : `<div style="width:100%;height:${h};border-radius:${radius};background:${ph}"></div>`);
const split = (s?: string) => { const [t, ...rest] = (s ?? "").split("\n"); return { t: t ?? "", b: rest.join("\n") }; };
const contact = (f: TplFields, c?: Partial<Company>) => [f.footerPhone || c?.phone, f.footerEmail || c?.email, f.footerWeb, f.footerAddress || c?.address].map((x) => x?.trim()).filter(Boolean) as string[];
const btn = (bg: string, fg: string, label?: string, url?: string, serif = false) => `<a href="${esc(url || "#")}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:800;font-size:14px;padding:13px 30px;border-radius:26px;${serif ? "font-family:Georgia,serif;" : ""}">${esc(label || "Find out more")}</a>`;
const wrap = (rows: string) => `<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:600px">${rows}</table></div>`;
const row = (inner: string, style = "") => `<tr><td style="${style}">${inner}</td></tr>`;
const cols = (items: string[], gap = 16) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%"><tr>${items.map((h, i) => `<td valign="top" width="${Math.floor(100 / items.length)}%" style="${i ? `padding-left:${gap / 2}px;` : ""}${i < items.length - 1 ? `padding-right:${gap / 2}px;` : ""}">${h}</td>`).join("")}</tr></table>`;
const grid = (items: (string | undefined)[], per: number, card: (it: string) => string) => { let o = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%">`; for (let i = 0; i < items.length; i += per) { o += "<tr>"; for (let j = 0; j < per; j++) { const it = items[i + j]; o += `<td valign="top" width="${Math.floor(100 / per)}%" style="padding:6px">${it ? card(it) : ""}</td>`; } o += "</tr>"; } return o + "</table>"; };
const brandLine = (f: TplFields, c: Partial<Company> | undefined, colour: string, align = "left") => `<div style="font-size:12px;font-weight:800;letter-spacing:1px;color:${colour};text-align:${align}">${esc((f.brand || c?.name || "Your business").toUpperCase())}</div>`;
const foot = (t: Theme, f: TplFields, c?: Partial<Company>) => { const b = contact(f, c); return b.length ? row(b.map(esc).join(" &nbsp;·&nbsp; "), `background:${t.aDeep};color:${t.onDeep};text-align:center;font-size:12px;font-weight:600;padding:16px`) : ""; };

interface Opts { button: boolean }
interface Structure { fields: string[]; render: (t: Theme, f: TplFields, c: Partial<Company> | undefined, o: Opts) => string }

const STRUCTURES: Record<string, Structure> = {
  // Full-bleed accent hero — bold announcements.
  bigHero: { fields: ["brand", "heading", "subheading", "body", "cta", "footer"], render: (t, f, c, o) =>
    row(`${brandLine(f, c, t.onAMut)}<h1 style="margin:14px 0 0;font-size:38px;line-height:1.03;font-weight:900;color:${t.onA}">${esc(f.heading)}</h1><div style="margin-top:10px;font-size:17px;font-weight:600;color:${t.onAMut}">${esc(f.subheading)}</div>${para(f.body, `margin:16px 0 ${o.button ? "20px" : "0"};font-size:14px;line-height:1.65;color:${t.onAMut}`)}${o.button ? btn(t.onA, readable(t.onA), f.ctaLabel, f.ctaUrl) : ""}`, `background:${t.a};background-image:linear-gradient(160deg,${t.a},${t.aDark});padding:34px 30px 38px`) + foot(t, f, c) },
  // Photo on top, soft accent title panel below.
  photoHero: { fields: ["brand", "heroImage", "heading", "subheading", "body", "cta", "footer"], render: (t, f, c, o) =>
    row(brandLine(f, c, t.onA, "right"), `background:${t.a};padding:11px 18px`) + row(img(f.heroImage, "240px", "0", t.aDark), "padding:0;font-size:0;line-height:0") +
    row(`<h1 style="margin:0;font-size:30px;line-height:1.05;font-weight:800;color:${t.ink}">${esc(f.heading)}</h1><div style="margin-top:4px;font-size:21px;color:${t.ink}">${esc(f.subheading)}</div>`, `background:${t.aSoft};padding:24px`) +
    row(`${para(f.body, `margin:0 0 ${o.button ? "14px" : "0"};font-size:14px;line-height:1.65;color:${t.mut}`)}${o.button ? btn(t.a, t.onA, f.ctaLabel, f.ctaUrl) : ""}`, "padding:22px 30px 26px;text-align:center") + foot(t, f, c) },
  // Two photos + words, no button — photo stories.
  photoStory: { fields: ["brand", "heroImage", "heading", "body", "image2", "footer"], render: (t, f, c) =>
    row(brandLine(f, c, t.a), "padding:20px 24px 0") + row(img(f.heroImage, "230px", "12px", t.aDark), "padding:14px 24px 0;font-size:0;line-height:0") +
    row(`<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${t.ink}">${esc(f.heading)}</h1>${para(f.body, `margin:0;font-size:14px;line-height:1.65;color:${t.mut}`)}`, "padding:16px 24px 6px") +
    (f.image2 ? row(img(f.image2, "190px", "12px", t.aDark), "padding:6px 24px 20px;font-size:0;line-height:0") : row("", "padding:6px")) + foot(t, f, c) },
  // Dark hero + 2×2 event cards.
  eventGrid: { fields: ["brand", "heading", "subheading", "heroImage", "item1", "item2", "item3", "item4", "cta", "footer"], render: (t, f, c, o) => {
    const cardBg = shade(t.aDark, -12), cfg = readable(cardBg), cmut = mutedOn(cardBg);
    return row(`${brandLine(f, c, t.onDarkMut)}${f.heroImage ? `<img src="${esc(f.heroImage)}" alt="" width="100%" style="width:100%;height:120px;object-fit:cover;border-radius:14px;margin:14px 0;display:block">` : `<div style="height:16px"></div>`}<div style="text-align:center"><div style="width:46px;height:46px;line-height:46px;border-radius:50%;background:${t.a};color:${t.onA};margin:0 auto 12px;font-size:22px">🎉</div><h1 style="margin:0;font-size:32px;font-weight:900;color:${t.onDark}">${esc(f.heading)}</h1><div style="margin-top:8px;font-size:15px;color:${t.onDarkMut}">${esc(f.subheading)}</div></div>`, `background:${t.aDark};padding:26px 24px 30px`) +
      row(grid([f.item1, f.item2, f.item3, f.item4], 2, (it) => { const s = split(it); return `<div style="background:${cardBg};border-radius:14px;padding:14px 16px"><div style="font-weight:800;font-size:14px;color:${cfg};margin-bottom:6px">🎟 ${esc(s.t)}</div><div style="font-size:12px;line-height:1.5;color:${cmut}">${esc(s.b).replace(/\n/g, "<br>")}</div></div>`; }), `background:${t.aDeep};padding:12px`) +
      (o.button ? row(btn(t.a, t.onA, f.ctaLabel, f.ctaUrl), `background:${t.aDeep};padding:0 12px 22px;text-align:center`) : "") + foot(t, f, c) } },
  // Accent band + 3×2 light feature cards.
  featureGrid: { fields: ["brand", "heading", "badge", "heroImage", "item1", "item2", "item3", "item4", "item5", "item6", "cta", "footer"], render: (t, f, c, o) =>
    row(`${brandLine(f, c, t.onDarkMut)}<h1 style="margin:8px 0 4px;font-size:32px;font-weight:900;color:${t.onDark};letter-spacing:1px;text-align:center">${esc(f.heading)}</h1>`, `background:${t.aDeep};padding:22px 22px 16px`) +
    (f.badge ? row(`<div style="text-align:center;font-weight:800;font-size:13px;letter-spacing:.5px;color:${t.onA}">${esc(f.badge)}</div>`, `background:${t.a};padding:10px`) : "") +
    (f.heroImage ? row(img(f.heroImage, "170px", "0", t.aDark), "padding:0;font-size:0;line-height:0") : "") +
    row(grid([f.item1, f.item2, f.item3, f.item4, f.item5, f.item6], 3, (it) => { const s = split(it); return `<div style="background:${t.cardAlt};border-radius:8px;padding:12px"><div style="font-weight:800;font-size:12.5px;color:${t.ink};margin-bottom:4px">${esc(s.t)}</div><div style="font-size:11px;line-height:1.45;color:${t.mut}">${esc(s.b).replace(/\n/g, "<br>")}</div></div>`; }), `background:${t.aDeep};padding:12px`) +
    (o.button ? row(btn(t.a, t.onA, f.ctaLabel, f.ctaUrl), `background:${t.aDeep};padding:0 0 20px;text-align:center`) : "") + foot(t, f, c) },
  // Loud colour block, checklist pills, price badge.
  offerBold: { fields: ["brand", "heading", "subheading", "body", "item1", "item2", "item3", "badge", "heroImage", "cta", "footer"], render: (t, f, c, o) => {
    const chip = t.onA, chipFg = readable(chip);
    return row(`<div style="text-align:right"><span style="display:inline-block;background:${chip};color:${chipFg};font-weight:800;font-size:12px;padding:7px 12px;border-radius:12px">${esc(f.brand || c?.name || "Your business")}</span></div>`, `background:${t.a};padding:12px 22px 0`) +
      row(`<h1 style="margin:0;font-size:32px;font-weight:900;line-height:1;color:${t.onA}">${esc(f.heading)}</h1><div style="margin-top:6px;font-size:19px;font-style:italic;font-weight:800;color:${t.onAMut}">${esc(f.subheading)}</div>${para(f.body, `margin:14px 0 14px;font-size:13.5px;line-height:1.6;color:${t.onAMut}`)}${[f.item1, f.item2, f.item3].filter(Boolean).map((i) => `<div style="background:${chip};color:${chipFg};font-weight:800;font-size:14px;padding:11px 18px;border-radius:24px;margin-bottom:10px">✓ ${esc(i)}</div>`).join("")}${f.badge ? `<div style="margin-top:10px"><span style="display:inline-block;background:${chip};color:${chipFg};font-weight:900;font-size:16px;padding:12px 26px;border-radius:26px">${esc(f.badge)}</span></div>` : ""}${o.button ? `<div style="margin-top:16px">${btn(chip, chipFg, f.ctaLabel, f.ctaUrl)}</div>` : ""}`, `background:${t.a};padding:8px 26px 26px`) +
      (f.heroImage ? row(img(f.heroImage, "170px", "0", t.aDark), "padding:0;font-size:0;line-height:0") : "") + foot(t, f, c) } },
  // Elegant serif, image, offer pill.
  serif: { fields: ["brand", "heroImage", "heading", "badge", "subheading", "body", "cta", "footer"], render: (t, f, c, o) =>
    row(`<div style="text-align:center;font-family:Georgia,serif;font-size:16px;letter-spacing:1px;color:${t.aDark}">${esc(f.brand || c?.name || "Your business")}</div>`, "padding:16px 0 8px") +
    (f.heroImage ? row(img(f.heroImage, "240px", "0", t.aDark), "padding:0;font-size:0;line-height:0") : "") +
    row(`<h1 style="margin:0 0 12px;font-size:38px;font-family:Georgia,serif;color:${t.ink}">${esc(f.heading)}</h1>${f.badge ? `<span style="display:inline-block;background:${t.a};color:${t.onA};font-weight:700;font-size:15px;padding:9px 24px;border-radius:24px">${esc(f.badge)}</span>` : ""}${f.subheading ? `<div style="margin-top:14px;font-size:16px;color:${t.mut}">${esc(f.subheading)}</div>` : ""}${para(f.body, `margin:12px 0 0;font-size:13.5px;line-height:1.65;color:${t.mut}`)}`, "text-align:center;padding:22px 26px 10px") +
    (o.button ? row(btn(t.a, t.onA, f.ctaLabel, f.ctaUrl, true), "text-align:center;padding:6px 0 22px") : "") + row("", `background:${t.a};padding:8px`) + foot(t, f, c) },
  // Serif masthead, colour band, two columns.
  corporate: { fields: ["brand", "heading", "subheading", "heroImage", "sectionTitle", "sectionBody", "item1", "item2", "footer"], render: (t, f, c) =>
    row(`<table role="presentation" width="100%" style="border-collapse:collapse"><tr><td style="font-size:13px;font-weight:800;letter-spacing:1px;color:${t.ink}">${esc((f.brand || c?.name || "Your business").toUpperCase())}</td><td align="right"><span style="display:inline-block;width:30px;height:30px;border-radius:50%;background:${t.a}"></span></td></tr></table><h1 style="margin:6px 0 0;font-size:44px;line-height:.95;font-weight:900;color:${t.ink};font-family:Georgia,serif;letter-spacing:-1px">${esc(f.heading)}</h1><div style="height:3px;width:70px;background:${t.a};margin:12px 0 10px"></div><div style="font-size:16px;color:${t.mut};font-family:Georgia,serif">${esc(f.subheading)}</div>`, "padding:26px 26px 8px") +
    (f.heroImage ? row(img(f.heroImage, "205px", "0", t.aDark), "padding:0;font-size:0;line-height:0") : "") +
    row(`<h2 style="margin:0 0 6px;font-size:19px;font-weight:800;color:${t.onA}">${esc(f.sectionTitle)}</h2>${para(f.sectionBody, `margin:0;font-size:13.5px;line-height:1.6;color:${t.onAMut}`)}`, `background:${t.a};padding:22px 26px`) +
    row(cols([f.item1, f.item2].map((it) => { const s = split(it); return `<div style="height:3px;width:34px;background:${t.a};margin-bottom:8px"></div><h3 style="margin:0 0 6px;font-size:15px;font-weight:800;color:${t.ink}">${esc(s.t)}</h3><div style="font-size:12.5px;line-height:1.55;color:${t.mut}">${esc(s.b)}</div>`; }), 18), "padding:24px 26px") + foot(t, f, c) },
  // Bordered card, image grid, deal bullets.
  digest: { fields: ["brand", "heroImage", "heading", "body", "cta", "image2", "image3", "sectionTitle", "item1", "item2", "item3", "sectionBody", "footer"], render: (t, f, c, o) => {
    const cc = contact(f, c);
    return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px solid ${t.line};border-radius:20px;overflow:hidden;width:100%">
      <tr><td style="text-align:center;padding:14px;font-size:13px;color:${t.mut}">${esc(f.brand || c?.name || "Your business")}</td></tr>
      <tr><td style="font-size:0;line-height:0">${img(f.heroImage, "180px", "0", t.aDark)}</td></tr>
      <tr><td style="text-align:center;padding:20px 26px 6px"><h1 style="margin:0;font-size:22px;font-weight:800;color:${t.ink}">${esc(f.heading)}</h1>${para(f.body, `margin:8px 0 12px;font-size:13.5px;line-height:1.6;color:${t.mut}`)}${o.button ? `<a href="${esc(f.ctaUrl || "#")}" style="display:inline-block;border:1.5px solid ${t.a};color:${t.a};text-decoration:none;font-weight:800;font-size:12.5px;letter-spacing:.5px;padding:10px 22px;border-radius:4px">${esc((f.ctaLabel || "See more").toUpperCase())}</a>` : ""}</td></tr>
      <tr><td style="padding:16px 16px 6px">${cols([img(f.image2, "120px", "12px", t.aDark), img(f.image3, "120px", "12px", t.aDark)], 10)}</td></tr>
      <tr><td style="padding:14px 22px 20px">${cols([`<h4 style="margin:0 0 6px;font-size:13px;font-weight:800;color:${t.ink}">${esc(f.sectionTitle)}</h4><ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.7;color:${t.mut}">${[f.item1, f.item2, f.item3].filter(Boolean).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`, `<h4 style="margin:0 0 6px;font-size:13px;font-weight:800;color:${t.ink}">Snapshot</h4><div style="font-size:12px;line-height:1.6;color:${t.mut}">${esc(f.sectionBody)}</div>`], 18)}</td></tr>
      ${cc.length ? `<tr><td style="background:${t.a};color:${t.onA};text-align:center;font-size:12px;font-weight:600;padding:16px">${cc.map(esc).join(" &nbsp;·&nbsp; ")}</td></tr>` : ""}
    </table>`, "padding:10px") },
  },
  // Framed, bright newsletter with two image rows.
  newsletter: { fields: ["brand", "heading", "body", "sectionTitle", "sectionBody", "image2", "item1", "item2", "image3", "footer"], render: (t, f, c) => {
    const cc = contact(f, c);
    return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:6px solid ${t.a};border-radius:20px;overflow:hidden;width:100%">
      <tr><td style="background:${t.a};padding:9px 16px"><table role="presentation" width="100%"><tr><td style="font-size:11px;font-weight:800;letter-spacing:1px;color:${t.onA}">${esc((f.brand || c?.name || "Your business").toUpperCase())}</td><td align="right" style="font-size:11px;font-weight:800;color:${t.onA}">VOL. 01</td></tr></table></td></tr>
      <tr><td style="padding:22px 22px 6px"><h1 style="margin:0;font-size:38px;font-weight:900;color:${t.ink};line-height:1">${esc(f.heading)}</h1>${para(f.body, `margin:10px 0 0;font-size:13px;line-height:1.6;color:${t.mut}`)}</td></tr>
      <tr><td style="padding:16px 22px">${cols([`<h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:${t.ink}">${esc(f.sectionTitle)}</h3><div style="font-size:12.5px;line-height:1.55;color:${t.mut}">${esc(f.sectionBody)}</div>`, img(f.image2, "110px", "12px", t.aDark)], 14)}</td></tr>
      <tr><td style="padding:0 22px 18px">${cols([img(f.image3, "110px", "12px", t.aDark), `<h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:${t.ink}">${esc(f.item1)}</h3><div style="font-size:12.5px;line-height:1.55;color:${t.mut}">${esc(f.item2)}</div>`], 14)}</td></tr>
      ${cc.length ? `<tr><td style="background:${t.a};color:${t.onA};text-align:center;font-size:12px;font-weight:600;padding:14px">${cc.map(esc).join(" &nbsp;·&nbsp; ")}</td></tr>` : ""}
    </table>`, "padding:8px") },
  },
  // Big quote / shout-out, no button.
  quote: { fields: ["brand", "heading", "subheading", "body", "footer"], render: (t, f, c) =>
    row(`<div style="text-align:center;font-size:12px;font-weight:800;letter-spacing:1px;color:${t.onAMut}">${esc((f.brand || c?.name || "Your business").toUpperCase())}</div><div style="text-align:center;font-size:64px;line-height:.7;margin-top:10px;font-family:Georgia,serif;color:${t.onA}">&ldquo;</div><div style="text-align:center;font-size:23px;line-height:1.4;font-family:Georgia,serif;font-weight:600;color:${t.onA}">${esc(f.heading)}</div>${f.subheading ? `<div style="text-align:center;margin-top:14px;font-size:14px;font-weight:800;color:${t.onAMut}">${esc(f.subheading)}</div>` : ""}${para(f.body, `text-align:center;margin:12px 0 0;font-size:13.5px;line-height:1.6;color:${t.onAMut}`)}`, `background:${t.a};background-image:linear-gradient(160deg,${t.a},${t.aDark});padding:26px 30px 34px`) + foot(t, f, c) },
  // Clean notice with a left accent bar — reminders, admin.
  notice: { fields: ["brand", "heading", "body", "cta", "footer"], render: (t, f, c, o) =>
    row(brandLine(f, c, t.a), "padding:24px 26px 0") +
    row(`<div style="border-left:4px solid ${t.a};padding-left:16px"><h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:${t.ink}">${esc(f.heading)}</h1>${para(f.body, `margin:0;font-size:14px;line-height:1.65;color:${t.mut}`)}</div>${o.button ? `<div style="margin-top:18px;padding-left:20px">${btn(t.a, t.onA, f.ctaLabel, f.ctaUrl)}</div>` : ""}`, "padding:16px 26px 26px") + foot(t, f, c) },
  // Warm welcome + two "what to bring" columns.
  welcome: { fields: ["brand", "heroImage", "heading", "subheading", "body", "item1", "item2", "cta", "footer"], render: (t, f, c, o) =>
    row(`${brandLine(f, c, t.onAMut)}<h1 style="margin:12px 0 6px;font-size:32px;font-weight:900;color:${t.onA}">${esc(f.heading)}</h1><div style="font-size:15px;color:${t.onAMut}">${esc(f.subheading)}</div>`, `background:${t.a};padding:28px 26px`) +
    (f.heroImage ? row(img(f.heroImage, "180px", "0", t.aDark), "padding:0;font-size:0;line-height:0") : "") +
    row(`${para(f.body, `margin:0 0 16px;font-size:14px;line-height:1.65;color:${t.mut}`)}${cols([f.item1, f.item2].map((it) => { const s = split(it); return `<div style="background:${t.aSoft};border-radius:12px;padding:14px"><div style="font-size:14px;font-weight:800;color:${t.aDark};margin-bottom:4px">${esc(s.t)}</div><div style="font-size:12.5px;line-height:1.55;color:${t.mut}">${esc(s.b)}</div></div>`; }), 12)}${o.button ? `<div style="text-align:center;margin-top:18px">${btn(t.a, t.onA, f.ctaLabel, f.ctaUrl)}</div>` : ""}`, "padding:22px 26px") + foot(t, f, c) },
  // Urgency — big badge/date, then message.
  countdown: { fields: ["brand", "badge", "heading", "subheading", "body", "cta", "footer"], render: (t, f, c, o) =>
    row(`<div style="text-align:center;font-size:12px;font-weight:800;letter-spacing:1px;color:${t.onAMut}">${esc((f.brand || c?.name || "Your business").toUpperCase())}</div><div style="text-align:center;margin:14px 0"><span style="display:inline-block;background:${t.onA};color:${readable(t.onA)};font-size:26px;font-weight:900;padding:14px 28px;border-radius:14px">${esc(f.badge || "3 days left")}</span></div><h1 style="margin:0;text-align:center;font-size:30px;font-weight:900;color:${t.onA}">${esc(f.heading)}</h1><div style="text-align:center;margin-top:8px;font-size:16px;color:${t.onAMut}">${esc(f.subheading)}</div>${para(f.body, `text-align:center;margin:12px 0 0;font-size:13.5px;line-height:1.6;color:${t.onAMut}`)}${o.button ? `<div style="text-align:center;margin-top:18px">${btn(t.onA, readable(t.onA), f.ctaLabel, f.ctaUrl)}</div>` : ""}`, `background:${t.a};background-image:linear-gradient(160deg,${t.a},${t.aDark});padding:30px 28px 34px`) + foot(t, f, c) },
  // Numbered tips list — editorial, no button.
  tips: { fields: ["brand", "heading", "item1", "item2", "item3", "item4", "footer"], render: (t, f, c) =>
    row(`${brandLine(f, c, t.a)}<h1 style="margin:10px 0 0;font-size:28px;font-weight:900;color:${t.ink}">${esc(f.heading)}</h1>`, "padding:24px 26px 4px") +
    row([f.item1, f.item2, f.item3, f.item4].filter(Boolean).map((it, i) => { const s = split(it); return `<div style="padding:14px 0;border-top:1px solid ${t.line}"><span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:${t.aSoft};color:${t.aDark};font-weight:800;font-size:13px;margin-right:10px">${i + 1}</span><span style="font-size:16px;font-weight:800;color:${t.ink}">${esc(s.t)}</span><div style="margin:6px 0 0 36px;font-size:13px;line-height:1.6;color:${t.mut}">${esc(s.b)}</div></div>`; }).join(""), "padding:6px 26px 22px") + foot(t, f, c) },
};

export interface CampaignTemplate { id: string; name: string; vibe: string; category: string; accentId: string; structure: string; button: boolean; fields: string[]; seed: TplFields; render: (f: TplFields, a: string, c?: Partial<Company>) => string }
const mk = (id: string, name: string, category: string, accentId: string, structure: string, button: boolean, seed: TplFields): CampaignTemplate => { const s = STRUCTURES[structure]; return { id, name, vibe: name, category, accentId, structure, button, fields: button ? s.fields : s.fields.filter((k) => k !== "cta"), seed, render: (f, a, c) => wrap(s.render(theme(a), f, c, { button })) }; };

export const TEMPLATES: CampaignTemplate[] = [
  mk("refer", "Refer a friend", "Promote", "mint", "photoHero", true, { heading: "Refer a friend.", subheading: "You both win.", body: "When a friend you refer books their first session, you'll each get £10 off your next booking.", ctaLabel: "Get your link" }),
  mk("summer-open", "Camp now open", "Promote", "blue", "bigHero", true, { heading: "Summer camp is OPEN", subheading: "Six weeks of adventure, sport and friends.", body: "Weekly places across all our venues — from £22 a day, with early & late care included.", ctaLabel: "Book your weeks" }),
  mk("last-places", "Last few places", "Promote", "red", "countdown", true, { badge: "Only 6 spaces", heading: "Nearly full!", subheading: "Don't miss out on half-term", body: "A handful of places remain for the week of the 21st. Once they're gone, they're gone.", ctaLabel: "Grab a place" }),
  mk("early-bird", "Early-bird offer", "Promote", "blue", "offerBold", true, { heading: "EARLY-BIRD PRICES", subheading: "book by Sunday & save", body: "Lock in the best rate of the year across every holiday club.", item1: "Multi-Sports Camp", item2: "Forest Adventure Club", item3: "Creative Studio", badge: "SAVE 20%", ctaLabel: "Book & save" }),
  mk("flash-sale", "Flash sale", "Promote", "red", "offerBold", true, { heading: "48-HOUR FLASH SALE", subheading: "this weekend only", body: "Use the code at checkout — one per family, ends Sunday midnight.", item1: "Any holiday club week", item2: "Any weekend workshop", badge: "20% OFF", ctaLabel: "Shop the sale" }),
  mk("waitlist", "Waitlist opened", "Promote", "amber", "bigHero", true, { heading: "A place just opened up", subheading: "You're near the top of the list.", body: "A space has become available for the dates you wanted. First to confirm keeps it.", ctaLabel: "Claim the place" }),
  mk("new-activity", "New activity", "Promote", "coral", "photoHero", true, { heading: "Introducing…", subheading: "something new for the term", body: "We've added a brand-new session by popular request. Take a look and grab an early place.", ctaLabel: "See the details" }),
  mk("birthday", "Birthday parties", "Promote", "pink", "serif", true, { heading: "Party with us.", badge: "Now booking", subheading: "Unforgettable birthdays, zero stress for you.", body: "Games, activities and a whole lot of fun — we bring the energy, you enjoy the day.", ctaLabel: "Enquire now" }),

  mk("open-day", "Open day invite", "Announce", "navy", "eventGrid", true, { heading: "You're invited", subheading: "Come and see what we're about", item1: "Open Morning\nSat 12 Jul · 10–12", item2: "Taster Session\nWed 16 Jul · 4–5pm", item3: "Meet the Team\nFri 18 Jul · 3–4pm", item4: "Q&A for Parents\nSun 20 Jul · 11am", ctaLabel: "Let us know you're coming" }),
  mk("new-venue", "New venue", "Announce", "coral", "bigHero", true, { heading: "We're opening a new venue!", subheading: "More places, closer to home.", body: "From September you'll find us at a brand-new site with even more space to play and learn.", ctaLabel: "See the venue" }),
  mk("holiday-schedule", "Holiday schedule", "Announce", "navy", "featureGrid", true, { heading: "HOLIDAY CLUB", badge: "SUMMER 2026 DATES", item1: "Week 1\n21–25 Jul", item2: "Week 2\n28 Jul–1 Aug", item3: "Week 3\n4–8 Aug", item4: "Week 4\n11–15 Aug", item5: "Week 5\n18–22 Aug", item6: "Week 6\n25–29 Aug", ctaLabel: "Book any week" }),
  mk("showcase", "Activity showcase", "Announce", "blue", "featureGrid", true, { heading: "WHAT'S ON", badge: "SOMETHING FOR EVERYONE", item1: "Multi-Sports\nEvery weekday", item2: "Forest School\nRain or shine", item3: "Arts & Crafts\nMessy & fun", item4: "Drama Club\nBig stage energy", item5: "Coding Lab\nBuild & play", item6: "Cooking\nTaste the win", ctaLabel: "Explore all activities" }),
  mk("anniversary", "We're celebrating", "Announce", "purple", "serif", true, { heading: "Ten years of play.", badge: "2016 – 2026", subheading: "Thank you for being part of the story.", body: "A decade of muddy knees, proud faces and brilliant memories — and we're just getting started.", ctaLabel: "See how we've grown" }),
  mk("fundraiser", "Fundraiser", "Announce", "pink", "bigHero", true, { heading: "Help us give back", subheading: "Our summer charity drive is on.", body: "Every booking this month puts a little towards free places for families who need them most.", ctaLabel: "Get involved" }),

  mk("welcome", "Welcome to the club", "Welcome", "teal", "welcome", false, { heading: "Welcome aboard!", subheading: "We're so pleased to have you with us.", body: "Here's everything you need for a brilliant first day.", item1: "What to bring\nPacked lunch, water bottle, sun cream and a coat — just in case.", item2: "Drop-off & pick-up\nDoors open 8:45am. Please collect by 3:30pm (or use late care)." }),
  mk("what-to-bring", "What to bring", "Welcome", "teal", "welcome", false, { heading: "See you soon!", subheading: "A quick note before your session.", body: "A few reminders so the day runs smoothly for everyone.", item1: "Pack\nLabelled lunch, snacks, water and weather-ready clothes.", item2: "Please note\nNo nuts on site. Let us know of any changes to collection." }),
  mk("meet-team", "Meet the team", "Welcome", "purple", "photoStory", false, { heading: "Meet the people behind the fun", body: "Every one of our team is DBS-checked, first-aid trained and genuinely brilliant with children. Say hello — they can't wait to meet your family." }),

  mk("weekly", "Weekly round-up", "Update", "purple", "digest", true, { heading: "This week's round-up", body: "Handpicked highlights and what's coming up — book early, sessions fill fast.", sectionTitle: "Top picks", item1: "Multi-Sports — from £22/day", item2: "Forest School — Sat mornings", item3: "Holiday Club — filling fast", sectionBody: "Tag us with #OurCamp for a chance to be featured next week.", ctaLabel: "See what's on" }),
  mk("photo-story", "Camp photo story", "Update", "amber", "photoStory", false, { heading: "What a week!", body: "From mini-Olympics to den-building, the children packed a lot in. Here's a peek at all the fun — more photos are on your parent app." }),
  mk("term-dates", "Term dates", "Update", "teal", "featureGrid", false, { heading: "TERM DATES", badge: "PLAN YOUR YEAR", item1: "Autumn\n2 Sep – 20 Dec", item2: "Half-term\n27–31 Oct", item3: "Spring\n6 Jan – 4 Apr", item4: "Half-term\n16–20 Feb", item5: "Summer\n22 Apr – 22 Jul", item6: "INSET\nTBC — we'll confirm" }),
  mk("menu", "Menu update", "Update", "teal", "digest", false, { heading: "New on the menu", body: "Freshly refreshed and packed with favourites — all allergen-friendly and child-approved.", sectionTitle: "This month", item1: "Mon — Pasta & garlic bread", item2: "Wed — Chicken wraps", item3: "Fri — Fish & chips", sectionBody: "Let us know of any dietary needs and we'll always cater for them." }),
  mk("parent-tips", "Parent tips", "Update", "teal", "tips", false, { heading: "5 ways to make mornings easier", item1: "Lay it out the night before\nBag packed, clothes ready, lunch made — future-you says thanks.", item2: "Name everything\nLabels save a world of lost-property heartache.", item3: "Little jobs\nGiving children a task builds independence (and buys you a minute).", item4: "Keep it calm\nA five-minute head start beats a ten-minute rush every time." }),
  mk("review", "Review request", "Update", "blue", "notice", true, { heading: "How did we do?", body: "We'd love a quick word on how your child found their sessions. It takes a minute and genuinely helps other families choose us.", ctaLabel: "Leave a review" }),
  mk("survey", "Survey invite", "Update", "purple", "notice", true, { heading: "Two minutes of your time?", body: "We're planning next term and your view shapes it — venues, times, activities, the lot. Every answer counts.", ctaLabel: "Take the survey" }),

  mk("seasonal", "Seasonal greeting", "Seasonal", "red", "quote", false, { heading: "Wishing your family a wonderful holiday, and a happy, healthy new year.", subheading: "— from all of us" }),
  mk("end-of-term", "End of term thank you", "Seasonal", "amber", "quote", false, { heading: "Thank you for a brilliant term. Rest up, have fun, and we'll see you next time.", subheading: "— the whole team" }),
  mk("star", "Star of the week", "Seasonal", "pink", "quote", false, { heading: "Kindness, effort and the biggest smile all week — you're a star.", subheading: "Well done to this week's shining star ⭐", body: "We love celebrating the little wins. Ask your child about their moment!" }),

  mk("payment", "Payment reminder", "Admin", "navy", "notice", false, { heading: "A friendly payment reminder", body: "Your balance for the upcoming sessions is due soon. You can pay securely in your parent account — no rush, just a nudge so your place stays held." }),
  mk("closure", "Closure notice", "Admin", "red", "notice", false, { heading: "Important: session update", body: "Due to circumstances beyond our control, the session on this date won't run. We're sorry for any disruption — affected families will be contacted directly about options." }),
  mk("price-update", "Price update", "Admin", "navy", "notice", false, { heading: "A note on our prices", body: "From the new term our session prices will change slightly, so we can keep our ratios small and our team brilliant. Full details are in your account — thank you for your continued support." }),
];

export const CATEGORIES = ["All", "Promote", "Announce", "Welcome", "Update", "Seasonal", "Admin"];
export const templateOf = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
export const accentHex = (id: string) => TPL_ACCENTS.find((a) => a.id === id)?.hex ?? id;
export function renderDesignHtml(d: CampaignDesign, c?: Partial<Company>): string { const t = templateOf(d.templateId); return t.render(d.fields, accentHex(d.accent) || d.accent, c); }
export function renderDesignText(d: CampaignDesign): string { const f = d.fields; return [f.heading, f.subheading, f.badge, f.body, f.sectionTitle, f.sectionBody, f.item1, f.item2, f.item3, f.item4, f.item5, f.item6, f.ctaLabel && f.ctaUrl ? `${f.ctaLabel}: ${f.ctaUrl}` : ""].map((s) => (s ?? "").trim()).filter(Boolean).join("\n\n"); }
export const newDesign = (templateId: string, c?: Partial<Company>): CampaignDesign => { const t = templateOf(templateId); return { templateId, accent: t.accentId, fields: { brand: c?.name || "", footerPhone: c?.phone, footerEmail: c?.email, footerAddress: c?.address, ...t.seed } }; };

// ── The designer: pick a template, recolour, fill fields, live preview ──────
const FIELD_META: Record<string, { label: string; kind: "text" | "area" | "image"; ph?: string }> = {
  brand: { label: "Business name", kind: "text" }, heroImage: { label: "Main image", kind: "image" },
  image2: { label: "Second image", kind: "image" }, image3: { label: "Third image", kind: "image" },
  heading: { label: "Headline", kind: "text" }, subheading: { label: "Sub-headline", kind: "text" },
  body: { label: "Message", kind: "area" }, sectionTitle: { label: "Section title", kind: "text" }, sectionBody: { label: "Section text", kind: "area" },
  badge: { label: "Badge / offer / date", kind: "text" },
  item1: { label: "Item 1", kind: "area" }, item2: { label: "Item 2", kind: "area" }, item3: { label: "Item 3", kind: "area" },
  item4: { label: "Item 4", kind: "area" }, item5: { label: "Item 5", kind: "area" }, item6: { label: "Item 6", kind: "area" },
};
const inputCls = "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]";

export function CampaignDesigner({ initial, company, onCancel, onSave }: { initial?: CampaignDesign | null; company?: Partial<Company>; onCancel: () => void; onSave: (d: CampaignDesign) => void }) {
  const [design, setDesign] = useState<CampaignDesign | null>(initial ?? null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [cat, setCat] = useState("All");
  const tpl = design ? templateOf(design.templateId) : null;
  const setF = (k: keyof TplFields, v: string) => setDesign((d) => (d ? { ...d, fields: { ...d.fields, [k]: v } } : d));
  const pick = (id: string) => setDesign((d) => (d && d.templateId === id ? d : newDesign(id, company)));
  const upload = async (k: keyof TplFields, file: File) => { setBusyKey(k); try { const small = await downscaleImage(file); const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl: small }); setF(k, url); } catch { /* ignore */ } setBusyKey(null); };
  const shown = cat === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-[3vh]" onClick={onCancel}>
      <div className="flex w-full max-w-[1040px] flex-col overflow-hidden rounded-3xl bg-[var(--card,#fff)] shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "94vh" }}>
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
          <div><div className="text-[16px] font-extrabold">{design ? "Design your email" : "Choose a template"}</div><div className="text-[12px] text-white/75">{design ? tpl?.name : "30 ready-made designs built for activity providers — recolour and make each one yours."}</div></div>
          <div className="flex items-center gap-2">{design && <button type="button" onClick={() => onSave(design)} className="rounded-lg bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f]">Use this design</button>}<button type="button" onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[16px] font-bold">×</button></div>
        </div>

        {!design ? (
          <>
            <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-5 py-3">
              {CATEGORIES.map((k) => <button key={k} type="button" onClick={() => setCat(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${cat === k ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>{k}{k !== "All" && <span className="ml-1 opacity-60">{TEMPLATES.filter((t) => t.category === k).length}</span>}</button>)}
            </div>
            <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((t) => (
                <button key={t.id} type="button" onClick={() => pick(t.id)} className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-left transition hover:-translate-y-0.5 hover:border-[#2f6bd8] hover:shadow-lg">
                  <div className="h-56 overflow-hidden bg-[#f3f6fb]"><div style={{ width: 600, transform: "scale(0.46)", transformOrigin: "top left", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: t.render({ ...t.seed, brand: company?.name || t.seed.brand || "Your business" }, accentHex(t.accentId), company) }} /></div>
                  <div className="flex items-center justify-between border-t border-[var(--line)] px-3.5 py-2.5"><div><div className="text-[13.5px] font-extrabold text-[var(--ink)]">{t.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{t.category}{!t.button && " · no button"}</div></div><span className="rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11px] font-bold text-[#1d3a8f]">Use →</span></div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_440px]">
            <div className="min-h-0 space-y-3 overflow-y-auto border-r border-[var(--line)] p-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setDesign(null)} className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">← Templates</button>
                <span className="text-[13px] font-extrabold text-[var(--ink)]">{tpl?.name}</span>
              </div>
              <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Colour</div>
                <div className="flex flex-wrap gap-1.5">{TPL_ACCENTS.map((a) => <button key={a.id} type="button" onClick={() => setDesign((d) => (d ? { ...d, accent: a.id } : d))} title={a.name} className={`h-7 w-7 rounded-full border-2 ${design.accent === a.id ? "border-[#0b1730]" : "border-white shadow"}`} style={{ background: a.hex }} />)}</div></div>
              {(tpl?.fields ?? []).map((k) => k === "footer"
                ? <div key="footer" className="rounded-xl border border-[var(--line)] p-3"><div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Footer contact <span className="font-normal normal-case text-[var(--ink-3)]">— optional</span></div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={design.fields.footerPhone ?? ""} onChange={(e) => setF("footerPhone", e.target.value)} placeholder="Phone" className={inputCls} />
                      <input value={design.fields.footerEmail ?? ""} onChange={(e) => setF("footerEmail", e.target.value)} placeholder="Email" className={inputCls} />
                      <input value={design.fields.footerWeb ?? ""} onChange={(e) => setF("footerWeb", e.target.value)} placeholder="Website" className={inputCls} />
                      <input value={design.fields.footerAddress ?? ""} onChange={(e) => setF("footerAddress", e.target.value)} placeholder="Address" className={inputCls} /></div></div>
                : k === "cta"
                  ? <div key="cta" className="grid grid-cols-2 gap-2"><div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Button label</div><input value={design.fields.ctaLabel ?? ""} onChange={(e) => setF("ctaLabel", e.target.value)} placeholder="Book now" className={inputCls} /></div><div><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Button link</div><input value={design.fields.ctaUrl ?? ""} onChange={(e) => setF("ctaUrl", e.target.value)} placeholder="https://…" className={inputCls} /></div></div>
                  : (() => { const m = FIELD_META[k]; if (!m) return null; const val = (design.fields[k as keyof TplFields] as string) ?? ""; return (
                      <div key={k}><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{m.label}</div>
                        {m.kind === "image"
                          ? (val
                              ? <div className="flex items-center gap-2"><img src={val} alt="" className="h-12 w-20 flex-none rounded-lg border border-[var(--line)] object-cover" /><button type="button" onClick={() => setF(k as keyof TplFields, "")} className="rounded-full border border-[#f0c9cd] px-2.5 py-1 text-[11.5px] font-bold text-[#c02636] hover:bg-[#fdecec]">Remove</button></div>
                              : <div className="flex flex-wrap items-center gap-2"><label className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{busyKey === k ? "Uploading…" : "⬆ Upload"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(k as keyof TplFields, f); e.target.value = ""; }} /></label><span className="text-[12px] text-[var(--ink-3)]">or</span><input value={val} onChange={(e) => setF(k as keyof TplFields, e.target.value)} placeholder="Paste URL" className={`${inputCls} min-w-[130px] flex-1`} /></div>)
                          : m.kind === "area"
                            ? <textarea value={val} onChange={(e) => setF(k as keyof TplFields, e.target.value)} rows={2} placeholder={m.ph} className={inputCls} />
                            : <input value={val} onChange={(e) => setF(k as keyof TplFields, e.target.value)} placeholder={m.ph} className={inputCls} />}
                      </div>); })())}
            </div>
            <div className="min-h-0 overflow-y-auto bg-[#eef1f6] p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Live preview</div>
              <div className="mx-auto overflow-hidden rounded-xl bg-white shadow-sm" dangerouslySetInnerHTML={{ __html: renderDesignHtml(design, company) }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
