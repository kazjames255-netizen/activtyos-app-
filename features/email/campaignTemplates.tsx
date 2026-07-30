"use client";
/* eslint-disable @next/next/no-img-element -- campaign images are arbitrary operator-uploaded URLs; next/image doesn't fit inline-styled email HTML. */

// ─────────────────────────────────────────────────────────────────────────
// Campaign email templates — a gallery of BEAUTIFUL, distinct, ready-made
// designs (not the plain newsletter layouts). Each template renders to
// email-safe inline-styled HTML from a small set of fields + one accent colour,
// so the operator picks a look, drops in their words/photos, and sends.
// ─────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { post as apiPost } from "@/lib/api";
import { downscaleImage, type Company } from "@/features/newsfeed/newsletter";

export interface TplFields {
  brand?: string;
  heroImage?: string; image2?: string; image3?: string;
  heading?: string; subheading?: string; body?: string;
  ctaLabel?: string; ctaUrl?: string;
  sectionTitle?: string; sectionBody?: string;
  badge?: string;
  item1?: string; item2?: string; item3?: string; item4?: string; item5?: string; item6?: string;
  footerPhone?: string; footerEmail?: string; footerWeb?: string; footerAddress?: string;
}
export interface CampaignDesign { templateId: string; accent: string; fields: TplFields }

// Curated accents — each template ships a default, but the operator can recolour.
export const TPL_ACCENTS: { id: string; name: string; hex: string }[] = [
  { id: "mint", name: "Mint", hex: "#8fe3c2" }, { id: "blue", name: "Blue", hex: "#2f6bd8" },
  { id: "navy", name: "Navy", hex: "#16306e" }, { id: "coral", name: "Coral", hex: "#e79a86" },
  { id: "pink", name: "Pink", hex: "#ec4d8f" }, { id: "amber", name: "Amber", hex: "#f0a83c" },
  { id: "teal", name: "Teal", hex: "#2f8f83" }, { id: "purple", name: "Purple", hex: "#6d5ae0" },
  { id: "brown", name: "Mocha", hex: "#8a6f57" }, { id: "red", name: "Coral-red", hex: "#d9553f" },
];

// ── HTML helpers ──────────────────────────────────────────────────────────
const esc = (s?: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (s: string | undefined, style: string) => (s ?? "").split(/\n{2,}/).filter(Boolean).map((p) => `<p style="${style}">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const img = (url: string | undefined, h: string, radius = "0", ph = "#dfe6f0") => (url ? `<img src="${esc(url)}" alt="" style="display:block;width:100%;height:${h};object-fit:cover;border-radius:${radius}">` : `<div style="width:100%;height:${h};border-radius:${radius};background:linear-gradient(135deg,${ph},#c9d3e2)"></div>`);
const shade = (hex: string, amt: number) => { const n = parseInt(hex.slice(1), 16); const r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt)); return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`; };
const readable = (hex: string) => { const n = parseInt(hex.slice(1), 16); const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)); return lum > 150 ? "#0b1730" : "#ffffff"; };
const contact = (f: TplFields, c?: Partial<Company>) => [f.footerPhone || c?.phone, f.footerEmail || c?.email, f.footerWeb, f.footerAddress || c?.address].map((x) => x?.trim()).filter(Boolean) as string[];
const footerBar = (f: TplFields, c: Partial<Company> | undefined, bg: string, fg: string) => { const bits = contact(f, c); return bits.length ? `<div style="background:${bg};color:${fg};text-align:center;font-size:12px;font-weight:600;padding:16px">${bits.map(esc).join(' &nbsp;·&nbsp; ')}</div>` : ""; };
const wrap = (inner: string, bg = "#ffffff") => `<div style="max-width:600px;margin:0 auto;background:${bg};font-family:system-ui,-apple-system,'Segoe UI',sans-serif;overflow:hidden">${inner}</div>`;
// Split "Title\nbody…" → { t, b }
const split = (s?: string) => { const [t, ...rest] = (s ?? "").split("\n"); return { t: t ?? "", b: rest.join("\n") }; };

export interface CampaignTemplate { id: string; name: string; vibe: string; accentId: string; fields: string[]; seed: TplFields; render: (f: TplFields, a: string, c?: Partial<Company>) => string }

export const TEMPLATES: CampaignTemplate[] = [
  // 1 ─ Rewards / referral — rounded hero + overlapping soft panel
  {
    id: "rewards", name: "Reap the rewards", vibe: "Soft & friendly", accentId: "mint",
    fields: ["brand", "heroImage", "heading", "subheading", "body", "ctaLabel", "ctaUrl", "footer"],
    seed: { heading: "Refer a friend.", subheading: "Reap the rewards.", body: "We believe great days out are better when they're shared.\n\nWhen a friend you refer books their first session, you'll both get £10 off your next booking. Everyone wins.", ctaLabel: "Get your link", ctaUrl: "" },
    render: (f, a, c) => wrap(`
      <div style="position:relative">${img(f.heroImage, "250px", "0 0 42px 42px", shade(a, 40))}
        <div style="position:absolute;top:16px;right:16px;background:${a};color:${readable(a)};font-weight:800;font-size:13px;padding:8px 15px;border-radius:22px">${esc(f.brand || c?.name || "Your business")}</div></div>
      <div style="margin:-34px 22px 0;background:${a}55;border-radius:26px;padding:26px 24px">
        <h1 style="margin:0;font-size:32px;line-height:1.05;color:#0b1730;font-weight:800">${esc(f.heading)}</h1>
        <div style="margin-top:4px;font-size:23px;color:#0b1730">${esc(f.subheading)}</div></div>
      <div style="padding:22px 30px 26px;text-align:center">${para(f.body, "margin:0 0 12px;font-size:14px;line-height:1.65;color:#4b5563")}
        ${f.ctaLabel ? `<a href="${esc(f.ctaUrl || "#")}" style="display:inline-block;margin-top:6px;background:#0b1730;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:26px">${esc(f.ctaLabel)}</a>` : ""}</div>
      ${footerBar(f, c, a, readable(a))}`),
  },
  // 2 ─ Corporate newsletter — bold serif masthead, colour band, two columns
  {
    id: "corporate", name: "Corporate newsletter", vibe: "Bold & editorial", accentId: "red",
    fields: ["brand", "heading", "subheading", "heroImage", "sectionTitle", "sectionBody", "item1", "item2", "footer"],
    seed: { heading: "NEWSLETTER", subheading: "Shaping days out, inspiring young minds.", sectionTitle: "Driving change this season", sectionBody: "A round-up of everything happening across our camps and clubs — new venues, fresh activities and the moments that made us smile.", item1: "Committed to excellence\nOur team keeps raising the bar with new training and fresh ideas every term.", item2: "Growth for every child\nMore places, more choice, and programmes built around what your family needs." },
    render: (f, a, c) => wrap(`
      <div style="padding:26px 26px 6px">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:800;letter-spacing:1px;color:#0b1730">${esc((f.brand || c?.name || "YOUR BUSINESS").toUpperCase())}</span><span style="width:34px;height:34px;border-radius:50%;background:${a};display:inline-block"></span></div>
        <h1 style="margin:6px 0 0;font-size:46px;line-height:.95;font-weight:900;color:#0b1730;font-family:Georgia,serif;letter-spacing:-1px">${esc(f.heading)}</h1>
        <div style="height:3px;width:70px;background:${a};margin:12px 0 10px"></div>
        <div style="font-size:16px;color:#3b4453;font-family:Georgia,serif">${esc(f.subheading)}</div></div>
      ${img(f.heroImage, "220px", "0", shade(a, 60))}
      <div style="background:${a};color:${readable(a)};padding:22px 26px">
        <h2 style="margin:0 0 6px;font-size:19px;font-weight:800">${esc(f.sectionTitle)}</h2>
        ${para(f.sectionBody, "margin:0;font-size:13.5px;line-height:1.6;opacity:.95")}</div>
      <div style="display:flex;gap:18px;padding:24px 26px">
        ${[f.item1, f.item2].map((it) => { const s = split(it); return `<div style="flex:1"><div style="height:3px;width:34px;background:${a};margin-bottom:8px"></div><h3 style="margin:0 0 6px;font-size:15px;font-weight:800;color:#0b1730">${esc(s.t)}</h3><div style="font-size:12.5px;line-height:1.55;color:#5b6472">${esc(s.b)}</div></div>`; }).join("")}</div>
      ${footerBar(f, c, a, readable(a))}`),
  },
  // 3 ─ Tech event — dark hero + 2×2 event card grid
  {
    id: "event", name: "Event line-up", vibe: "Dark & modern", accentId: "navy",
    fields: ["brand", "heading", "subheading", "heroImage", "item1", "item2", "item3", "item4", "footer"],
    seed: { heading: "Summer Showcase", subheading: "The biggest family event of the year", item1: "Sports Day\nSat 12 Jul · 10:00–13:00", item2: "Open Morning\nWed 16 Jul · 09:30–11:30", item3: "Talent Show\nFri 18 Jul · 17:00–19:00", item4: "Family BBQ\nSun 20 Jul · 12:00–15:00" },
    render: (f, a, c) => wrap(`
      <div style="position:relative;background:linear-gradient(160deg,${shade(a, -30)},${a});padding:30px 26px 34px;color:#fff;text-align:center">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;opacity:.8;text-align:left">${esc(f.brand || c?.name || "YOUR BUSINESS")}</div>
        ${f.heroImage ? `<img src="${esc(f.heroImage)}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:14px;margin:14px 0;opacity:.9">` : `<div style="height:14px"></div>`}
        <div style="width:46px;height:46px;border-radius:50%;background:${shade(a, 50)};margin:0 auto 12px;line-height:46px;font-size:22px">🚀</div>
        <h1 style="margin:0;font-size:34px;font-weight:900;line-height:1.05">${esc(f.heading)}</h1>
        <div style="margin-top:8px;font-size:15px;opacity:.85">${esc(f.subheading)}</div></div>
      <div style="background:${shade(a, -46)};padding:18px;display:flex;flex-wrap:wrap;gap:12px">
        ${[f.item1, f.item2, f.item3, f.item4].map((it) => { const s = split(it); return `<div style="flex:1 1 44%;background:${shade(a, -20)};border-radius:14px;padding:14px 16px;color:#fff"><div style="font-weight:800;font-size:14px;margin-bottom:6px">🎟 ${esc(s.t)}</div><div style="font-size:12px;line-height:1.5;color:#c7d2ea">${esc(s.b).replace(/\n/g, "<br>")}</div></div>`; }).join("")}</div>
      ${footerBar(f, c, shade(a, -46), "#c7d2ea")}`),
  },
  // 4 ─ Beauty / seasonal — coral serif hero + product trio
  {
    id: "seasonal", name: "Seasonal offer", vibe: "Elegant serif", accentId: "coral",
    fields: ["brand", "heroImage", "heading", "badge", "subheading", "image2", "image3", "ctaLabel", "ctaUrl", "footer"],
    seed: { heading: "Summer Ready.", badge: "Save 20%", subheading: "everything your summer needs", ctaLabel: "Book the summer", ctaUrl: "" },
    render: (f, a, c) => wrap(`
      <div style="text-align:center;padding:16px 0 6px;font-family:Georgia,serif;font-size:17px;color:${shade(a, -60)};font-weight:700">${esc(f.brand || c?.name || "Your business")}</div>
      <div style="position:relative">${img(f.heroImage, "260px", "0", shade(a, 30))}
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff">
          <h1 style="margin:0;font-size:44px;font-family:Georgia,serif;text-shadow:0 2px 12px rgba(0,0,0,.35)">${esc(f.heading)}</h1>
          ${f.badge ? `<span style="margin-top:14px;background:${a};color:${readable(a)};font-weight:700;font-size:15px;padding:9px 24px;border-radius:24px">${esc(f.badge)}</span>` : ""}</div></div>
      <div style="text-align:center;padding:20px 24px 8px;font-size:16px;color:#3b4453">${esc(f.subheading)}</div>
      <div style="display:flex;gap:10px;padding:10px 20px 22px">
        ${[f.heroImage, f.image2, f.image3].map((u) => `<div style="flex:1">${img(u, "120px", "14px", shade(a, 40))}</div>`).join("")}</div>
      ${f.ctaLabel ? `<div style="text-align:center;padding:0 0 22px"><a href="${esc(f.ctaUrl || "#")}" style="display:inline-block;background:${a};color:${readable(a)};text-decoration:none;font-weight:700;font-size:14px;padding:12px 30px;border-radius:26px;font-family:Georgia,serif">${esc(f.ctaLabel)}</a></div>` : ""}
      <div style="height:56px;background:${a}"></div>${footerBar(f, c, shade(a, -30), "#fff")}`),
  },
  // 5 ─ Playful weekly — memphis shapes, pink/yellow energy
  {
    id: "playful", name: "Playful weekly", vibe: "Fun & bright", accentId: "pink",
    fields: ["brand", "heading", "body", "sectionTitle", "sectionBody", "image2", "item1", "item2", "image3", "footer"],
    seed: { heading: "This Week!", body: "Big news, brilliant photos and everything your family needs for the week ahead.", sectionTitle: "Camp highlights", sectionBody: "The children smashed our mini-Olympics — medals, mud and a whole lot of laughing.", item1: "Coming up", item2: "Early-bird places for the next holiday club open Friday — don't miss out." },
    render: (f, a, c) => { const y = "#ffd23f"; return wrap(`
      <div style="border:8px solid ${a};border-radius:22px;margin:8px;padding:0;overflow:hidden;position:relative">
        <div style="position:absolute;top:8px;left:10px;color:${y};font-size:22px">✦ ✦</div>
        <div style="background:${a};color:${readable(a)};display:flex;justify-content:space-between;padding:8px 16px;font-size:11px;font-weight:800;letter-spacing:1px"><span>${esc((f.brand || c?.name || "YOUR BUSINESS").toUpperCase())}</span><span>VOL. 01</span></div>
        <div style="padding:22px 22px 6px"><h1 style="margin:0;font-size:40px;font-weight:900;color:#0b1730;line-height:1">${esc(f.heading)}</h1>
          ${para(f.body, "margin:10px 0 0;font-size:13px;line-height:1.6;color:#4b5563")}</div>
        <div style="display:flex;gap:14px;align-items:center;padding:18px 22px">
          <div style="flex:1"><h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:#0b1730">${esc(f.sectionTitle)}</h3><div style="font-size:12.5px;line-height:1.55;color:#5b6472">${esc(f.sectionBody)}</div></div>
          <div style="flex:1">${img(f.image2, "110px", "12px", shade(a, 40))}</div></div>
        <div style="display:flex;gap:14px;align-items:center;padding:0 22px 20px">
          <div style="flex:1">${img(f.image3, "110px", "12px", "#ffe38a")}</div>
          <div style="flex:1"><h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:#0b1730">${esc(f.item1)}</h3><div style="font-size:12.5px;line-height:1.55;color:#5b6472">${esc(f.item2)}</div></div></div>
        <div style="background:${y};text-align:center;padding:6px;color:#0b1730;font-size:18px">• • • • • • • •</div>
        ${footerBar(f, c, a, readable(a))}</div>`); },
  },
  // 6 ─ Travel-style digest — clean card, image grid, deal bullets
  {
    id: "digest", name: "Curated digest", vibe: "Clean & premium", accentId: "teal",
    fields: ["brand", "heroImage", "heading", "body", "ctaLabel", "ctaUrl", "image2", "image3", "sectionTitle", "item1", "item2", "item3", "sectionBody", "footer"],
    seed: { heading: "This month's picks", body: "Handpicked sessions our families loved most — book early, they fill up fast.", ctaLabel: "See what's on", ctaUrl: "", sectionTitle: "Top picks this week", item1: "Multi-Sports Camp — from £22/day", item2: "Forest School — Sat mornings", item3: "Holiday Club — 20% off this month", sectionBody: "Tag us in your photos with #OurCamp for a chance to be featured next week." },
    render: (f, a, c) => wrap(`
      <div style="border:1px solid #e6ebf2;border-radius:20px;margin:10px;overflow:hidden">
        <div style="text-align:center;padding:14px;font-size:13px;color:#8a93a3">${esc(f.brand || c?.name || "Your business")}</div>
        ${img(f.heroImage, "180px", "0", shade(a, 40))}
        <div style="text-align:center;padding:20px 26px 6px"><h1 style="margin:0;font-size:22px;font-weight:800;color:#0b1730">${esc(f.heading)}</h1>
          ${para(f.body, "margin:8px 0 12px;font-size:13.5px;line-height:1.6;color:#5b6472")}
          ${f.ctaLabel ? `<a href="${esc(f.ctaUrl || "#")}" style="display:inline-block;border:1.5px solid #0b1730;color:#0b1730;text-decoration:none;font-weight:700;font-size:12.5px;letter-spacing:.5px;padding:10px 22px;border-radius:4px">${esc((f.ctaLabel).toUpperCase())}</a>` : ""}</div>
        <div style="display:flex;gap:10px;padding:16px 16px 6px">${[f.image2, f.image3].map((u) => `<div style="flex:1">${img(u, "120px", "12px", shade(a, 30))}</div>`).join("")}</div>
        <div style="display:flex;gap:18px;padding:14px 22px 20px">
          <div style="flex:1"><h4 style="margin:0 0 6px;font-size:13px;font-weight:800;color:#0b1730">${esc(f.sectionTitle)}</h4><ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.7;color:#5b6472">${[f.item1, f.item2, f.item3].filter(Boolean).map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>
          <div style="flex:1"><h4 style="margin:0 0 6px;font-size:13px;font-weight:800;color:#0b1730">Snapshot</h4><div style="font-size:12px;line-height:1.6;color:#5b6472">${esc(f.sectionBody)}</div></div></div>
        ${footerBar(f, c, a, readable(a))}</div>`),
  },
  // 7 ─ Flash sale — elegant mocha, serif, outline pill
  {
    id: "flash", name: "Flash sale", vibe: "Warm & refined", accentId: "brown",
    fields: ["brand", "heroImage", "heading", "badge", "image2", "sectionTitle", "sectionBody", "ctaLabel", "ctaUrl", "footer"],
    seed: { heading: "Flash Sale", badge: "GET 20% OFF", sectionTitle: "How to make the most of it", sectionBody: "Use the code at checkout on any holiday club booking. Ends Sunday at midnight — one per family.", ctaLabel: "Read more", ctaUrl: "" },
    render: (f, a, c) => wrap(`
      <div style="text-align:center;padding:14px;font-family:Georgia,serif;font-size:15px;letter-spacing:2px;color:${shade(a, -30)}">${esc((f.brand || c?.name || "Your business").toUpperCase())}</div>
      <div style="position:relative">${img(f.heroImage, "300px", "0", shade(a, 20))}
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center">
          <h1 style="margin:0;font-size:40px;font-family:Georgia,serif;text-shadow:0 2px 14px rgba(0,0,0,.4)">${esc(f.heading)}</h1>
          ${f.badge ? `<span style="margin-top:16px;border:1.5px solid #fff;font-size:15px;letter-spacing:1px;padding:11px 26px;border-radius:26px">${esc(f.badge)}</span>` : ""}</div></div>
      <div style="display:flex;gap:16px;align-items:center;padding:22px 26px">
        <div style="flex:0 0 40%">${img(f.image2, "130px", "10px", shade(a, 30))}</div>
        <div style="flex:1"><h3 style="margin:0 0 8px;font-size:19px;font-family:Georgia,serif;color:${shade(a, -40)}">${esc(f.sectionTitle)}</h3>
          ${para(f.sectionBody, "margin:0 0 12px;font-size:13px;line-height:1.6;color:#5b6472")}
          ${f.ctaLabel ? `<a href="${esc(f.ctaUrl || "#")}" style="display:inline-block;border:1.5px solid ${shade(a, -30)};color:${shade(a, -30)};text-decoration:none;font-size:12px;letter-spacing:.5px;padding:9px 20px;border-radius:22px">${esc(f.ctaLabel)}</a>` : ""}</div></div>
      ${footerBar(f, c, shade(a, -35), "#f3ece4")}`),
  },
  // 8 ─ Big bold deals — strong colour, checklist pills, price badge
  {
    id: "bigdeal", name: "Big bold offer", vibe: "Loud & punchy", accentId: "blue",
    fields: ["brand", "heading", "subheading", "body", "item1", "item2", "item3", "heroImage", "badge", "footer"],
    seed: { heading: "EXCLUSIVE PLACES", subheading: "you won't want to miss", body: "Book now and lock in our best rates of the year across every holiday club and camp.", item1: "Multi-Sports Camp", item2: "Forest Adventure Club", item3: "Family Fun Days", badge: "FROM £18/day" },
    render: (f, a, c) => { const y = "#ffcf33"; return wrap(`
      <div style="background:linear-gradient(160deg,${a},${shade(a, -40)});color:#fff;padding:30px 26px 20px;position:relative">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="max-width:62%"><h1 style="margin:0;font-size:34px;font-weight:900;line-height:1">${esc(f.heading)}</h1>
            <div style="margin-top:6px;font-size:20px;font-style:italic;font-weight:800;color:${y}">${esc(f.subheading)}</div></div>
          <span style="background:${y};color:#0b1730;font-weight:800;font-size:12px;padding:8px 12px;border-radius:12px">${esc(f.brand || c?.name || "Your business")}</span></div>
        ${para(f.body, "margin:16px 0 14px;font-size:13.5px;line-height:1.6;color:#dfe8fb;max-width:62%")}
        <div style="max-width:70%">${[f.item1, f.item2, f.item3].filter(Boolean).map((i) => `<div style="background:${y};color:#0b1730;font-weight:800;font-size:14px;padding:11px 18px;border-radius:24px;margin-bottom:10px">✓ ${esc(i)}</div>`).join("")}</div>
        ${f.badge ? `<div style="position:absolute;right:20px;bottom:16px;width:96px;height:96px;border-radius:50%;background:#fff;color:${shade(a, -30)};font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.2;padding:8px">${esc(f.badge)}</div>` : ""}
        ${f.heroImage ? `<img src="${esc(f.heroImage)}" alt="" style="position:absolute;right:0;top:0;width:140px;height:160px;object-fit:cover;border-bottom-left-radius:80px;opacity:.9">` : ""}</div>
      ${footerBar(f, c, shade(a, -46), "#dfe8fb")}`); },
  },
  // 9 ─ Featured showcase — teal frame, accent band, 3×2 feature grid
  {
    id: "showcase", name: "Featured showcase", vibe: "Structured & smart", accentId: "teal",
    fields: ["brand", "heading", "badge", "heroImage", "item1", "item2", "item3", "item4", "item5", "item6", "footer"],
    seed: { heading: "WHAT'S ON", badge: "THIS MONTH'S HIGHLIGHTS", item1: "Multi-Sports Camp\nEvery weekday, all summer", item2: "Forest School\nOutdoor fun, rain or shine", item3: "Early & late care\nWraparound to suit work", item4: "Small group ratios\nMore attention for every child", item5: "Qualified team\nDBS-checked, first-aid trained", item6: "Easy booking\nSecure a place in minutes" },
    render: (f, a, c) => wrap(`
      <div style="background:${shade(a, -40)};padding:22px 22px 16px;text-align:center">
        <div style="color:#cfe6e2;font-size:12px;font-weight:700;letter-spacing:1px;text-align:left">${esc(f.brand || c?.name || "YOUR BUSINESS")}</div>
        <h1 style="margin:8px 0 12px;font-size:34px;font-weight:900;color:#fff;letter-spacing:1px">${esc(f.heading)}</h1>
        ${f.badge ? `<div style="background:${a};color:${readable(a)};font-weight:800;font-size:13px;padding:9px;letter-spacing:.5px">${esc(f.badge)}</div>` : ""}</div>
      ${img(f.heroImage, "180px", "0", shade(a, 20))}
      <div style="background:${shade(a, -40)};padding:16px;display:flex;flex-wrap:wrap;gap:10px">
        ${[f.item1, f.item2, f.item3, f.item4, f.item5, f.item6].map((it) => { const s = split(it); return `<div style="flex:1 1 30%;background:#f4f6f8;border-radius:8px;padding:12px 12px;min-width:120px"><div style="font-weight:800;font-size:12.5px;color:#0b1730;margin-bottom:4px">${esc(s.t)}</div><div style="font-size:11px;line-height:1.45;color:#5b6472">${esc(s.b).replace(/\n/g, "<br>")}</div></div>`; }).join("")}</div>
      ${footerBar(f, c, a, readable(a))}`),
  },
];

export const templateOf = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
export const accentHex = (id: string) => TPL_ACCENTS.find((a) => a.id === id)?.hex ?? id;
export function renderDesignHtml(d: CampaignDesign, c?: Partial<Company>): string { const t = templateOf(d.templateId); return t.render(d.fields, accentHex(d.accent) || d.accent, c); }
export function renderDesignText(d: CampaignDesign): string { const f = d.fields; return [f.heading, f.subheading, f.badge, f.body, f.sectionTitle, f.sectionBody, f.item1, f.item2, f.item3, f.item4, f.item5, f.item6, f.ctaLabel && f.ctaUrl ? `${f.ctaLabel}: ${f.ctaUrl}` : ""].map((s) => (s ?? "").trim()).filter(Boolean).join("\n\n"); }
export const newDesign = (templateId: string, c?: Partial<Company>): CampaignDesign => { const t = templateOf(templateId); return { templateId, accent: t.accentId, fields: { brand: c?.name || "", footerPhone: c?.phone, footerEmail: c?.email, footerAddress: c?.address, ...t.seed } }; };

// ── The designer: pick a template, recolour, fill fields, live preview ──────
const FIELD_META: Record<string, { label: string; kind: "text" | "area" | "image" | "url"; ph?: string }> = {
  brand: { label: "Business name", kind: "text" }, heroImage: { label: "Main image", kind: "image" },
  image2: { label: "Second image", kind: "image" }, image3: { label: "Third image", kind: "image" },
  heading: { label: "Headline", kind: "text" }, subheading: { label: "Sub-headline", kind: "text" },
  body: { label: "Message", kind: "area" }, ctaLabel: { label: "Button label", kind: "text" }, ctaUrl: { label: "Button link", kind: "url", ph: "https://…" },
  sectionTitle: { label: "Section title", kind: "text" }, sectionBody: { label: "Section text", kind: "area" },
  badge: { label: "Badge / offer", kind: "text" },
  item1: { label: "Item 1", kind: "area" }, item2: { label: "Item 2", kind: "area" }, item3: { label: "Item 3", kind: "area" },
  item4: { label: "Item 4", kind: "area" }, item5: { label: "Item 5", kind: "area" }, item6: { label: "Item 6", kind: "area" },
};
const inputCls = "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]";

export function CampaignDesigner({ initial, company, onCancel, onSave }: { initial?: CampaignDesign | null; company?: Partial<Company>; onCancel: () => void; onSave: (d: CampaignDesign) => void }) {
  const [design, setDesign] = useState<CampaignDesign | null>(initial ?? null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const tpl = design ? templateOf(design.templateId) : null;
  const setF = (k: keyof TplFields, v: string) => setDesign((d) => (d ? { ...d, fields: { ...d.fields, [k]: v } } : d));
  const pick = (id: string) => setDesign((d) => (d && d.templateId === id ? d : newDesign(id, company)));
  const upload = async (k: keyof TplFields, file: File) => { setBusyKey(k); try { const small = await downscaleImage(file); const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl: small }); setF(k, url); } catch { /* ignore */ } setBusyKey(null); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-[3vh]" onClick={onCancel}>
      <div className="flex w-full max-w-[1000px] flex-col overflow-hidden rounded-3xl bg-[var(--card,#fff)] shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "94vh" }}>
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
          <div><div className="text-[16px] font-extrabold">{design ? "Design your email" : "Choose a template"}</div><div className="text-[12px] text-white/75">Beautiful, ready-made layouts — pick one and make it yours.</div></div>
          <div className="flex items-center gap-2">{design && <button type="button" onClick={() => onSave(design)} className="rounded-lg bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f]">Use this design</button>}<button type="button" onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[16px] font-bold">×</button></div>
        </div>

        {!design ? (
          <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => pick(t.id)} className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-left transition hover:-translate-y-0.5 hover:border-[#2f6bd8] hover:shadow-lg">
                <div className="h-52 overflow-hidden bg-[#f3f6fb]"><div style={{ width: 600, transform: "scale(0.42)", transformOrigin: "top left", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: t.render({ ...t.seed, brand: company?.name || t.seed.brand || "Your business" }, accentHex(t.accentId), company) }} /></div>
                <div className="flex items-center justify-between border-t border-[var(--line)] px-3.5 py-2.5"><div><div className="text-[13.5px] font-extrabold text-[var(--ink)]">{t.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{t.vibe}</div></div><span className="rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11px] font-bold text-[#1d3a8f]">Use →</span></div>
              </button>
            ))}
          </div>
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
