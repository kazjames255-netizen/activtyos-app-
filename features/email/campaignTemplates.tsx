"use client";
/* eslint-disable @next/next/no-img-element -- campaign images are arbitrary operator-uploaded URLs; next/image doesn't fit inline-styled email HTML. */

// ─────────────────────────────────────────────────────────────────────────
// Campaign email BUILDER — a block-based designer (like the newsfeed): 30
// detailed, camp/club-themed starting templates you edit block by block —
// duplicate, reorder (↑/↓), add or delete any section; every image has a full
// drag-to-reposition + zoom CROP (identical model to the newsletters); product
// cards, pricing tiers, colour bands, image+text splits and social rows.
// Social rows auto-fill from the profile links saved in settings.
// Email-safe (table-based, absolute-free); text colours derived from their
// background so any palette stays legible.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";
import { post as apiPost, get as apiGet } from "@/lib/api";
import { downscaleImage, type Company } from "@/features/newsfeed/newsletter";

export type BlockType = "header" | "logo" | "hero" | "band" | "heading" | "text" | "image" | "cards" | "tiers" | "split" | "button" | "social" | "divider" | "footer" | "quote" | "stats" | "checklist" | "code" | "contact" | "countdown" | "graph" | "collage";
export interface Card { image?: string; video?: string; ix?: number; iy?: number; iz?: number; title?: string; caption?: string; price?: string; label?: string; url?: string }
export interface Social { net: string; url?: string }
export type ImgShape = "landscape" | "square" | "portrait" | "wide";
export interface Block { k?: string; t: BlockType; heading?: string; subheading?: string; body?: string; image?: string; video?: string; ix?: number; iy?: number; iz?: number; size?: "s" | "m" | "full"; shape?: ImgShape; splitPct?: number; align?: "left" | "center" | "right"; label?: string; url?: string; caption?: string; cols?: number; cards?: Card[]; flip?: boolean; socials?: Social[]; item1?: string; item2?: string; item3?: string; item4?: string; item5?: string; item6?: string; footerPhone?: string; footerEmail?: string; footerWeb?: string; footerAddress?: string; date?: string; span?: "full" | "half" | "third"; chart?: "bars" | "columns" | "progress" | "stacked" | "pie"; unit?: string; variant?: string }
export interface CampaignDesign { templateId?: string; accent: string; blocks: Block[] }

export const TPL_ACCENTS: { id: string; name: string; hex: string }[] = [
  { id: "blue", name: "Blue", hex: "#2f6bd8" }, { id: "navy", name: "Navy", hex: "#1b3a8f" },
  { id: "teal", name: "Teal", hex: "#188f83" }, { id: "green", name: "Green", hex: "#2c9a52" },
  { id: "mint", name: "Mint", hex: "#3bbf9a" }, { id: "amber", name: "Amber", hex: "#e08a1e" },
  { id: "coral", name: "Coral", hex: "#e2694e" }, { id: "red", name: "Red", hex: "#d33d4a" },
  { id: "pink", name: "Pink", hex: "#d83f86" }, { id: "purple", name: "Purple", hex: "#6d54cf" },
];

// ── colour maths ─────────────────────────────────────────────────────────
const esc = (s?: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const shade = (hex: string, amt: number) => { const n = parseInt(hex.slice(1), 16); const r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt)); return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`; };
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const readable = (hex: string) => (lum(hex) > 155 ? "#101a2e" : "#ffffff");
const mutedOn = (hex: string) => (readable(hex) === "#ffffff" ? "rgba(255,255,255,.82)" : "rgba(16,26,46,.60)");
// A cohesive set of distinct-ish tones derived from the accent, for multi-series charts.
const chartColors = (accent: string, n: number) => { const offs = [0, -48, 46, -26, 72, 22]; return Array.from({ length: n }, (_, i) => shade(accent, offs[i % offs.length])); };
// Apply a unit to a value: currency symbols go in front, words/% after.
const applyUnit = (v?: string, unit?: string) => { const u = (unit || "").trim(), val = (v || "").trim(); if (!u || !val) return val; return /^[£$€]$/.test(u) ? `${u}${val}` : `${val}${u.length === 1 ? u : ` ${u}`}`; };
export interface Theme { a: string; aDark: string; aDeep: string; aSoft: string; onA: string; onAMut: string; onDeep: string; ink: string; mut: string; line: string; cardAlt: string }
const theme = (hex: string): Theme => { const a = hex, aDark = shade(hex, -42), aDeep = shade(hex, -72); return { a, aDark, aDeep, aSoft: hex + "1c", onA: readable(a), onAMut: mutedOn(a), onDeep: readable(aDeep), ink: "#14213a", mut: "#5b6472", line: "#e6ebf2", cardAlt: "#f4f6f8" }; };
export const accentHex = (id: string) => TPL_ACCENTS.find((a) => a.id === id)?.hex ?? id;

// ── html helpers ──────────────────────────────────────────────────────────
const para = (s: string | undefined, style: string) => (s ?? "").split(/\n{2,}/).filter(Boolean).map((p) => `<p style="${style}">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
// A cropped image: fixed-height frame + object-fit cover. Pan is object-position
// (0–100%, works at any zoom with no gaps) and zoom scales from the same anchor —
// email-safe and renders in every modern inbox.
const cropImg = (b: { image?: string; video?: string; ix?: number; iy?: number; iz?: number }, h: string, radius: string, ph: string) => {
  const x = b.ix ?? 50, y = b.iy ?? 50, z = b.iz ?? 1;
  if (b.video) {
    const isFile = /\.(mp4|webm|ogg|mov)(?:[?#]|$)/i.test(b.video);
    if (isFile) {
      // Direct video file — plays inline where the client supports HTML5 video
      // (Apple Mail, most webmail + this preview); poster is the clickable fallback.
      const poster = b.image ? ` poster="${esc(b.image)}"` : "";
      const ext = (b.video.split(/[?#]/)[0].split(".").pop() || "").toLowerCase();
      const mime = ext === "webm" ? "video/webm" : ext === "ogg" ? "video/ogg" : ext === "mov" ? "video/quicktime" : "video/mp4";
      const fb = `<a href="${esc(b.video)}" style="display:block;text-decoration:none">${b.image ? `<img src="${esc(b.image)}" alt="" style="width:100%;height:${h};object-fit:cover;border-radius:${radius};display:block">` : `<div style="height:${h};border-radius:${radius};background:#0b1020"></div>`}</a>`;
      return `<video controls playsinline preload="metadata"${poster} style="width:100%;height:${h};object-fit:cover;border-radius:${radius};display:block;background:#0b1020"><source src="${esc(b.video)}" type="${mime}">${fb}</video>`;
    }
    // YouTube / Vimeo / page link — clickable play-poster that opens the video.
    const yt = b.video.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
    const poster = b.image || (yt ? `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` : "");
    const posterHtml = poster ? `<img src="${esc(poster)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:${x}% ${y}%;transform:scale(${z});transform-origin:${x}% ${y}%;display:block">` : `<div style="width:100%;height:100%;background:#0b1020"></div>`;
    return `<a href="${esc(b.video)}" style="display:block;text-decoration:none"><div style="height:${h};overflow:hidden;border-radius:${radius};position:relative;background:#0b1020">${posterHtml}<div style="position:absolute;top:0;left:0;right:0;bottom:0"><table role="presentation" width="100%" height="100%" style="width:100%;height:100%"><tr><td align="center" valign="middle"><span style="display:inline-block;width:64px;height:64px;line-height:64px;text-align:center;border-radius:50%;background:rgba(214,0,0,.92);color:#ffffff;font-size:26px">▶</span></td></tr></table></div></div></a>`;
  }
  const inner = b.image
    ? `<img src="${esc(b.image)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:${x}% ${y}%;transform:scale(${z});transform-origin:${x}% ${y}%;display:block">`
    : `<div style="width:100%;height:100%;background:${ph}"></div>`;
  return `<div style="height:${h};overflow:hidden;border-radius:${radius}">${inner}</div>`;
};
// Image frame height for a given shape at a given pixel width (capped so tall shapes stay sensible).
const imgHeight = (shape: string, wpx: number) => { const r = shape === "square" ? 1 : shape === "portrait" ? 1.3 : shape === "wide" ? 0.4 : 0.7; return Math.min(Math.round(wpx * r), 470); };
const btn = (bg: string, fg: string, label?: string, url?: string) => `<a href="${esc(url || "#")}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:800;font-size:14px;padding:12px 28px;border-radius:26px">${esc(label || "Learn more")}</a>`;
const btnSm = (bg: string, fg: string, label?: string, url?: string) => `<a href="${esc(url || "#")}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:800;font-size:11px;padding:7px 14px;border-radius:14px">${esc(label || "More")}</a>`;
const row = (inner: string, style = "") => `<tr><td style="${style}">${inner}</td></tr>`;
const wrapRows = (rows: string) => `<div style="max-width:640px;margin:0 auto;background:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px">${rows}</table></div>`;

export const SOC: Record<string, { bg: string; ch: string; label: string }> = { facebook: { bg: "#3b5998", ch: "f", label: "Facebook" }, instagram: { bg: "#c13584", ch: "◎", label: "Instagram" }, tiktok: { bg: "#111111", ch: "♪", label: "TikTok" }, twitter: { bg: "#1da1f2", ch: "t", label: "X / Twitter" }, youtube: { bg: "#ff0000", ch: "▶", label: "YouTube" }, website: { bg: "#4a5568", ch: "🔗", label: "Website" } };
export const SOC_NETS = Object.keys(SOC);
const DEFAULT_SOCIALS: Social[] = [{ net: "facebook" }, { net: "instagram" }, { net: "tiktok" }, { net: "website" }];

// ── one block → email-safe html (theme-aware, cropped images) ───────────────
function renderBlock(b: Block, t: Theme, c?: Partial<Company>, now = 0): string {
  const brand = b.heading || c?.name || "Your business";
  switch (b.t) {
    case "header":
      return row(`<table role="presentation" width="100%" style="border-collapse:collapse"><tr><td style="font-size:17px;font-weight:900;letter-spacing:.5px;color:${t.onA}">${esc(brand)}</td>${b.subheading ? `<td align="right" style="font-size:12px;font-weight:600;color:${t.onAMut}">${esc(b.subheading)}</td>` : ""}</tr></table>`, `background:${t.a};padding:16px 22px`);
    case "hero":
      return (b.image || b.image === "" ? row(cropImg(b, "230px", "0", t.aDark), "padding:0;font-size:0;line-height:0") : "") +
        row(`<h1 style="margin:0;font-size:32px;line-height:1.05;font-weight:900;color:${t.onA}">${esc(b.heading)}</h1>${b.subheading ? `<div style="margin-top:8px;font-size:16px;font-weight:600;color:${t.onAMut}">${esc(b.subheading)}</div>` : ""}${para(b.body, `margin:12px 0 ${b.label ? "16px" : "0"};font-size:14px;line-height:1.6;color:${t.onAMut}`)}${b.label ? btn(t.onA, readable(t.onA), b.label, b.url) : ""}`, `background:${t.a};background-image:linear-gradient(160deg,${t.a},${t.aDark});padding:26px 26px 30px;text-align:center`);
    case "band":
      return row(`<h2 style="margin:0;font-size:17px;font-weight:800;color:${t.onA};text-align:center">${esc(b.heading)}</h2>${b.body ? `<div style="margin-top:5px;font-size:13px;color:${t.onAMut};text-align:center">${esc(b.body)}</div>` : ""}${b.label ? `<div style="text-align:center;margin-top:12px">${btn(t.onA, readable(t.onA), b.label, b.url)}</div>` : ""}`, `background:${t.a};padding:16px 24px`);
    case "heading":
      return row(`<h2 style="margin:0;font-size:23px;font-weight:800;color:${t.ink};text-align:center">${esc(b.heading)}</h2>${b.subheading ? `<div style="text-align:center;margin-top:4px;font-size:13.5px;color:${t.mut}">${esc(b.subheading)}</div>` : ""}<div style="height:3px;width:54px;background:${t.a};margin:12px auto 0"></div>${b.label ? `<div style="text-align:center;margin-top:16px">${btn(t.a, t.onA, b.label, b.url)}</div>` : ""}`, "padding:24px 26px 6px");
    case "text":
      return row(`${para(b.body, `margin:0 0 10px;font-size:14px;line-height:1.7;color:${t.mut}`)}${b.label ? `<div style="text-align:center;margin-top:10px">${btn(t.a, t.onA, b.label, b.url)}</div>` : ""}`, "padding:8px 30px");
    case "image": {
      const al = b.align || "center"; const shape = b.shape || "landscape";
      const hasText = !!(b.heading || b.body);
      const capHtml = b.caption ? `<div style="margin-top:6px;font-size:12px;color:${t.mut}">${esc(b.caption)}</div>` : "";
      const cta = b.label ? btn(t.a, t.onA, b.label, b.url) : "";
      // Smart: when the image isn't full width AND there's copy, flow it beside the image.
      if (b.size !== "full" && hasText) {
        const fracImg = Math.max(25, Math.min(70, b.splitPct ?? (b.size === "s" ? 38 : 52)));
        const H = imgHeight(shape, Math.round(600 * fracImg / 100));
        const imgTd = `<td valign="middle" width="${fracImg}%" style="padding-${al === "right" ? "left" : "right"}:14px">${cropImg(b, `${H}px`, "12px", t.aDark)}</td>`;
        const txtTd = `<td valign="middle" style="padding-${al === "right" ? "right" : "left"}:14px">${b.heading ? `<h3 style="margin:0 0 7px;font-size:17px;font-weight:800;color:${t.ink}">${esc(b.heading)}</h3>` : ""}${para(b.body, `margin:0;font-size:13px;line-height:1.6;color:${t.mut}`)}${capHtml}${cta ? `<div style="margin-top:12px">${cta}</div>` : ""}</td>`;
        return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%"><tr>${al === "right" ? txtTd + imgTd : imgTd + txtTd}</tr></table>`, "padding:14px 26px");
      }
      const frac = b.size === "s" ? 42 : b.size === "m" ? 64 : 100;
      const H = imgHeight(shape, Math.round(600 * frac / 100));
      return row(`<div style="text-align:${al}"><div style="display:inline-block;width:${frac}%;max-width:100%">${cropImg(b, `${H}px`, "12px", t.aDark)}</div>${capHtml}${cta ? `<div style="margin-top:12px">${cta}</div>` : ""}</div>`, "padding:12px 26px");
    }
    case "cards": {
      const per = b.cols || 3, cs = b.cards || []; let inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%"><tr>`;
      cs.forEach((cd, i) => { if (i > 0 && i % per === 0) inner += "</tr><tr>"; inner += `<td valign="top" width="${Math.floor(100 / per)}%" style="padding:8px;text-align:center"><div>${cd.image ? cropImg(cd, "110px", "10px", t.aDark) : ""}<div style="margin-top:8px;font-size:13px;font-weight:800;color:${t.ink}">${esc(cd.title)}</div>${cd.caption ? `<div style="font-size:11.5px;line-height:1.4;color:${t.mut};margin-top:2px">${esc(cd.caption)}</div>` : ""}${cd.price ? `<div style="margin-top:4px;font-size:13px;font-weight:800;color:${t.a}">${esc(cd.price)}</div>` : ""}${cd.label ? `<div style="margin-top:7px">${btnSm(t.a, t.onA, cd.label, cd.url)}</div>` : ""}</div></td>`; });
      const rem = cs.length % per; if (rem) for (let j = 0; j < per - rem; j++) inner += `<td width="${Math.floor(100 / per)}%"></td>`;
      return row(inner + "</tr></table>", "padding:12px 14px");
    }
    case "tiers": {
      const cs = b.cards || []; let inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%"><tr>`;
      cs.forEach((cd) => { inner += `<td valign="top" width="${Math.floor(100 / Math.max(cs.length, 1))}%" style="padding:6px"><div style="background:${t.cardAlt};border-radius:14px;padding:16px 12px;text-align:center;height:100%;box-sizing:border-box"><div style="font-size:13px;font-weight:800;color:${t.ink}">${esc(cd.title)}</div><div style="margin:8px 0;font-size:26px;font-weight:900;color:${t.a}">${esc(cd.price)}</div><div style="font-size:11.5px;line-height:1.5;color:${t.mut};min-height:34px">${esc(cd.caption)}</div>${cd.label ? `<div style="margin-top:10px">${btnSm(t.a, t.onA, cd.label, cd.url)}</div>` : ""}</div></td>`; });
      return row(inner + "</tr></table>", "padding:12px 14px");
    }
    case "split": {
      const im = cropImg(b, "150px", "10px", t.aDark);
      const txt = `<h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:${t.ink}">${esc(b.heading)}</h3>${para(b.body, `margin:0 0 ${b.label ? "12px" : "0"};font-size:13px;line-height:1.6;color:${t.mut}`)}${b.label ? btnSm(t.a, t.onA, b.label, b.url) : ""}`;
      const left = b.flip ? txt : im, right = b.flip ? im : txt;
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%"><tr><td valign="middle" width="46%" style="padding-right:9px">${left}</td><td valign="middle" width="54%" style="padding-left:9px">${right}</td></tr></table>`, "padding:14px 26px");
    }
    case "button":
      return row(btn(t.a, t.onA, b.label, b.url), `text-align:${b.align || "center"};padding:14px 26px`);
    case "social": {
      const list = (b.socials && b.socials.length ? b.socials : DEFAULT_SOCIALS);
      const icons = list.map((s) => { const m = SOC[s.net] || SOC.website; return `<td style="padding:0 5px"><a href="${esc(s.url || "#")}" style="text-decoration:none"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:50%;background:${m.bg};color:#fff;font-weight:800;font-size:14px">${m.ch}</span></a></td>`; }).join("");
      return row(`<table role="presentation" align="center" style="margin:0 auto;border-collapse:collapse"><tr>${icons}</tr></table>${b.heading ? `<div style="margin-top:8px;font-size:12px;color:${t.mut}">${esc(b.heading)}</div>` : ""}`, "text-align:center;padding:16px 26px");
    }
    case "logo": {
      const src = b.image || c?.logo; const h = b.size === "s" ? 34 : b.size === "full" ? 74 : 52; const al = b.align || "center";
      return row(src ? `<img src="${esc(src)}" alt="${esc(c?.name || "")}" style="height:${h}px;max-width:70%;object-fit:contain;display:inline-block">` : `<div style="display:inline-block;font-size:12px;color:${t.mut};border:1px dashed ${t.line};border-radius:8px;padding:14px 20px">Your saved logo shows here — add one in Settings › Branding.</div>`, `text-align:${al};padding:18px 26px`);
    }
    case "quote": {
      const q = esc(b.body || "Absolutely brilliant — my two had the best week ever!");
      const who = esc(b.heading || "— A very happy parent");
      const stars = `<div style="color:${t.a};font-size:16px;letter-spacing:3px">★★★★★</div>`;
      const v = b.variant || "centered";
      if (v === "card")
        return row(`<div style="border:1px solid ${t.line};border-left:5px solid ${t.a};border-radius:14px;padding:20px 24px;background:#fff;box-shadow:0 4px 16px -10px rgba(20,33,58,.35)">${stars}<div style="margin:10px 0;font-size:16px;line-height:1.55;color:${t.ink}">${q}</div><div style="font-size:12.5px;font-weight:800;color:${t.mut}">${who}</div></div>`, "padding:16px 26px");
      if (v === "bubble")
        return row(`<div style="background:${t.aSoft};border:1px solid ${t.line};border-radius:16px;padding:18px 22px"><div style="font-size:30px;line-height:.2;color:${t.a};font-family:Georgia,serif">&ldquo;</div><div style="margin:6px 0 2px;font-size:15.5px;line-height:1.55;font-style:italic;color:${t.ink}">${q}</div></div><div style="margin:8px 0 0 22px;font-size:12.5px;font-weight:800;color:${t.mut}">${who}</div>`, "padding:16px 26px");
      if (v === "avatar") {
        const ini = (b.heading || "P").replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || "P";
        return row(`<table role="presentation" width="100%" style="border-collapse:collapse"><tr><td width="60" valign="top"><span style="display:inline-block;width:52px;height:52px;line-height:52px;text-align:center;border-radius:50%;background:${t.a};color:${t.onA};font-weight:900;font-size:20px">${ini}</span></td><td valign="top" style="padding-left:14px">${stars}<div style="margin:6px 0;font-size:15px;line-height:1.5;color:${t.ink}">${q}</div><div style="font-size:12.5px;font-weight:800;color:${t.mut}">${who}</div></td></tr></table>`, "padding:18px 26px");
      }
      if (v === "minimal")
        return row(`<div style="border-left:4px solid ${t.a};padding-left:18px"><div style="font-size:19px;line-height:1.5;font-style:italic;color:${t.ink};font-family:Georgia,serif">&ldquo;${q}&rdquo;</div><div style="margin-top:10px;font-size:12.5px;font-weight:800;color:${t.mut}">${who}</div></div>`, "padding:18px 30px");
      if (v === "banner")
        return row(`<div style="text-align:center"><div style="color:${t.onA};font-size:16px;letter-spacing:3px;opacity:.9">★★★★★</div><div style="margin:12px 0;font-size:19px;line-height:1.5;font-weight:700;color:${t.onA};font-family:Georgia,serif">&ldquo;${q}&rdquo;</div><div style="font-size:12.5px;font-weight:800;color:${t.onAMut}">${who}</div></div>`, `background:${t.a};padding:28px 34px`);
      return row(`<div style="text-align:center">${stars}<div style="margin:12px 0;font-size:18px;line-height:1.55;font-style:italic;color:${t.ink};font-family:Georgia,serif">&ldquo;${q}&rdquo;</div><div style="font-size:12.5px;font-weight:800;color:${t.mut}">${who}</div></div>`, `background:${t.aSoft};padding:26px 34px`);
    }
    case "stats": {
      const cs = (b.cards || []).slice(0, 4); const inner = cs.map((cd) => `<td valign="top" width="${Math.floor(100 / Math.max(cs.length, 1))}%" style="text-align:center;padding:6px"><div style="font-size:30px;font-weight:900;color:${t.a}">${esc(cd.title)}</div><div style="font-size:12px;color:${t.mut};margin-top:2px">${esc(cd.caption)}</div></td>`).join("");
      return row(`<table role="presentation" width="100%" style="border-collapse:collapse;width:100%"><tr>${inner}</tr></table>`, "padding:22px 20px");
    }
    case "checklist": {
      const items = [b.item1, b.item2, b.item3, b.item4, b.item5, b.item6].filter(Boolean);
      return row(`${b.heading ? `<h3 style="margin:0 0 12px;font-size:19px;font-weight:800;color:${t.ink};text-align:center">${esc(b.heading)}</h3>` : ""}<table role="presentation" width="100%" style="border-collapse:collapse;max-width:420px;margin:0 auto">${items.map((it) => `<tr><td style="padding:6px 0;font-size:14px;line-height:1.4;color:${t.ink}"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:${t.a};color:${t.onA};font-weight:900;font-size:12px;margin-right:10px">✓</span>${esc(it)}</td></tr>`).join("")}</table>`, "padding:20px 30px");
    }
    case "code":
      return row(`<div style="border:2px dashed ${t.a};border-radius:14px;padding:16px 18px;text-align:center;background:${t.aSoft}"><div style="font-size:11px;font-weight:800;letter-spacing:1px;color:${t.mut};text-transform:uppercase">${esc(b.subheading || "Your code")}</div><div style="font-size:27px;font-weight:900;letter-spacing:2px;color:${t.a};margin:2px 0">${esc(b.heading || "SUMMER15")}</div><div style="font-size:12.5px;color:${t.mut}">${esc(b.body || "15% off your next booking — this week only.")}</div></div>`, "padding:14px 26px");
    case "contact": {
      const bits = [b.footerPhone || c?.phone, b.footerEmail || c?.email, b.footerWeb, b.footerAddress || c?.address].map((x) => x?.trim()).filter(Boolean) as string[];
      return row(`${b.heading ? `<div style="font-size:13px;font-weight:800;color:${t.onA};text-align:center${bits.length ? ";margin-bottom:6px" : ""}">${esc(b.heading)}</div>` : ""}${bits.length ? `<div style="text-align:center;font-size:13px;font-weight:600;color:${t.onA}">${bits.map((x) => esc(x)).join(" &nbsp;•&nbsp; ")}</div>` : ""}`, `background:${t.a};padding:16px 24px`);
    }
    case "countdown": {
      const target = b.date ? Date.parse(b.date) : NaN;
      const diff = !isNaN(target) && now > 0 ? Math.max(0, target - now) : null;
      const parts: [string, number][] = diff != null ? [["Days", Math.floor(diff / 86400000)], ["Hrs", Math.floor((diff % 86400000) / 3600000)], ["Mins", Math.floor((diff % 3600000) / 60000)], ["Secs", Math.floor((diff % 60000) / 1000)]] : [];
      const boxFg = readable(t.onA);
      const boxes = parts.map(([lab, v]) => `<td style="padding:0 4px"><div style="background:${t.onA};color:${boxFg};border-radius:12px;padding:10px 4px;min-width:54px"><div style="font-size:27px;font-weight:900;line-height:1">${String(v).padStart(2, "0")}</div><div style="font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;opacity:.72">${lab}</div></div></td>`).join("");
      const dateStr = !isNaN(target) ? new Date(target).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
      return row(`<div style="text-align:center"><div style="font-size:14px;font-weight:800;letter-spacing:.5px;color:${t.onA}">${esc(b.heading || "Hurry — offer ends soon")}</div>${diff != null ? `<table role="presentation" align="center" style="margin:14px auto 2px;border-collapse:separate"><tr>${boxes}</tr></table>` : `<div style="margin-top:8px;font-size:12px;color:${t.onAMut}">Pick a date &amp; time in the editor</div>`}${dateStr ? `<div style="margin-top:8px;font-size:12.5px;color:${t.onAMut}">Ends ${esc(dateStr)}</div>` : ""}${b.label ? `<div style="margin-top:14px">${btn(t.onA, readable(t.onA), b.label, b.url)}</div>` : ""}</div>`, `background:${t.a};background-image:linear-gradient(160deg,${t.a},${t.aDark});padding:24px 26px 28px`);
    }
    case "graph": {
      const cs = (b.cards || []).slice(0, 6);
      const vals = cs.map((cd) => parseFloat((cd.caption || "").replace(/[^0-9.-]/g, "")) || 0);
      const max = Math.max(1, ...vals); const total = vals.reduce((a, v) => a + v, 0) || 1;
      const cols = chartColors(t.a, cs.length); const kind = b.chart || "bars"; const dv = (cd: Card) => esc(applyUnit(cd.caption, b.unit));
      const title = b.heading ? `<h3 style="margin:0 0 16px;font-size:19px;font-weight:800;color:${t.ink};text-align:center">${esc(b.heading)}</h3>` : "";
      let body = "";
      if (kind === "columns") {
        body = `<table role="presentation" width="100%" style="border-collapse:collapse;width:100%;height:150px"><tr>${cs.map((cd, i) => `<td valign="bottom" style="text-align:center;padding:0 5px;vertical-align:bottom"><div style="font-size:12px;font-weight:800;color:${cols[i]}">${dv(cd)}</div><div style="height:${Math.max(Math.round((vals[i] / max) * 118), 4)}px;background-image:linear-gradient(180deg,${shade(cols[i], 28)},${cols[i]});border-radius:7px 7px 0 0;margin-top:4px"></div></td>`).join("")}</tr><tr>${cs.map((cd) => `<td style="text-align:center;padding-top:6px;font-size:11.5px;color:${t.mut}">${esc(cd.title)}</td>`).join("")}</tr></table>`;
      } else if (kind === "progress") {
        body = cs.map((cd, i) => `<div style="margin-bottom:11px"><div style="font-size:12.5px;font-weight:700;color:${t.ink};margin-bottom:4px">${esc(cd.title)}</div><div style="background:${t.aSoft};border-radius:20px;height:26px"><div style="background-image:linear-gradient(90deg,${cols[i]},${shade(cols[i], 28)});height:26px;border-radius:20px;width:${Math.max(Math.round((vals[i] / max) * 100), 12)}%;line-height:26px;text-align:right;color:#fff;font-size:11.5px;font-weight:800;padding-right:9px;box-sizing:border-box">${dv(cd)}</div></div></div>`).join("");
      } else if (kind === "stacked") {
        const segs = cs.map((cd, i) => `<td width="${Math.round((vals[i] / total) * 100)}%" style="background:${cols[i]};height:28px"></td>`).join("");
        const legend = cs.map((cd, i) => `<span style="display:inline-block;margin:8px 12px 0 0;font-size:12px;color:${t.ink}"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${cols[i]};margin-right:5px;vertical-align:middle"></span>${esc(cd.title)} <b>${dv(cd)}</b></span>`).join("");
        body = `<table role="presentation" width="100%" style="border-collapse:collapse;width:100%;border-radius:8px;overflow:hidden"><tr>${segs}</tr></table><div style="text-align:center">${legend}</div>`;
      } else if (kind === "pie") {
        let acc = 0; const stops = cs.map((cd, i) => { const s = (acc / total) * 360; acc += vals[i]; return `${cols[i]} ${s}deg ${(acc / total) * 360}deg`; }).join(",");
        const legend = cs.map((cd, i) => `<div style="margin-bottom:7px;font-size:12.5px;color:${t.ink}"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${cols[i]};margin-right:6px;vertical-align:middle"></span>${esc(cd.title)} <b>${dv(cd)}</b></div>`).join("");
        body = `<table role="presentation" width="100%" style="border-collapse:collapse;width:100%"><tr><td width="46%" style="text-align:center"><div style="width:150px;height:150px;border-radius:50%;background:conic-gradient(${stops});display:inline-block"><div style="width:74px;height:74px;border-radius:50%;background:#fff;margin:38px auto"></div></div></td><td valign="middle" style="vertical-align:middle;padding-left:10px">${legend}</td></tr></table>`;
      } else {
        body = `<table role="presentation" width="100%" style="border-collapse:collapse;width:100%">${cs.map((cd, i) => `<tr><td style="padding:6px 0;font-size:12.5px;font-weight:600;color:${t.ink};width:30%">${esc(cd.title)}</td><td style="padding:6px 8px 6px 0;width:56%"><div style="background:${t.aSoft};border-radius:6px;height:20px"><div style="background-image:linear-gradient(90deg,${cols[i]},${shade(cols[i], 25)});height:20px;border-radius:6px;width:${Math.max(Math.round((vals[i] / max) * 100), 3)}%"></div></div></td><td style="padding:6px 0;text-align:right;font-size:13px;font-weight:800;color:${cols[i]};width:14%">${dv(cd)}</td></tr>`).join("")}</table>`;
      }
      return row(`${title}${body}`, "padding:20px 30px");
    }
    case "collage": {
      const cs = (b.cards || []).slice(0, 4); const gap = "6px";
      let inner = "";
      if (b.cols && b.cols >= 2) {
        // equal row of photos
        inner = `<table role="presentation" width="100%" style="border-collapse:collapse;width:100%"><tr>${cs.map((cd, i) => `<td width="${Math.floor(100 / Math.max(cs.length, 1))}%" valign="top" style="${i ? `padding-left:${gap}` : ""}">${cropImg(cd, "150px", "12px", t.aDark)}</td>`).join("")}</tr></table>`;
      } else if (cs.length >= 3) {
        // big left + two stacked right
        inner = `<table role="presentation" width="100%" style="border-collapse:collapse;width:100%"><tr><td width="58%" valign="top" style="padding-right:${gap}">${cropImg(cs[0], "236px", "12px", t.aDark)}</td><td width="42%" valign="top"><div>${cropImg(cs[1], "115px", "12px", t.aDark)}</div><div style="height:${gap}"></div><div>${cropImg(cs[2], "115px", "12px", t.aDark)}</div>${cs[3] ? `<div style="height:${gap}"></div><div>${cropImg(cs[3], "115px", "12px", t.aDark)}</div>` : ""}</td></tr></table>`;
      } else {
        inner = `<table role="presentation" width="100%" style="border-collapse:collapse;width:100%"><tr>${cs.map((cd, i) => `<td width="${Math.floor(100 / Math.max(cs.length, 1))}%" valign="top" style="${i ? `padding-left:${gap}` : ""}">${cropImg(cd, "170px", "12px", t.aDark)}</td>`).join("")}</tr></table>`;
      }
      return row(`${b.heading ? `<h3 style="margin:0 0 12px;font-size:19px;font-weight:800;color:${t.ink};text-align:center">${esc(b.heading)}</h3>` : ""}${inner}`, "padding:16px 22px");
    }
    case "divider":
      return row(`<div style="height:1px;background:${t.line}"></div>`, "padding:4px 26px");
    case "footer":
      return row(`<div style="font-size:14px;font-weight:800;color:${t.ink}">${esc(brand)}</div>${b.body ? `<div style="margin-top:3px;font-size:12px;color:${t.mut}">${esc(b.body)}</div>` : ""}<div style="margin-top:8px;font-size:11px;color:${t.mut}">You're receiving this because your family has booked with us. <span style="color:${t.a}">Unsubscribe</span> any time.</div>`, `background:${t.cardAlt};text-align:center;padding:20px 26px`);
    default:
      return "";
  }
}

// ── seeds (camp/club themed, full multi-section campaigns) ───────────────────
const B = (t: BlockType, p: Partial<Block> = {}): Block => ({ t, ...p });
const C = (title: string, caption = "", price = "", label = ""): Card => ({ title, caption, price, label });
const foot = (): Block => B("footer", { body: "Your venue · Town · Postcode" });
const soc = (): Block => B("social", { heading: "Follow {company} for daily fun", socials: DEFAULT_SOCIALS });
const H = (sub = "") => B("header", { subheading: sub });

export interface CampaignTemplate { id: string; name: string; category: string; accentId: string; blocks: () => Block[] }
export const TEMPLATES: CampaignTemplate[] = [
  { id: "summer-multi", name: "Multi-activity camp", category: "Offers & bookings", accentId: "blue", blocks: () => [H("Summer 2026"), B("hero", { heading: "Summer Multi-Activity Camp", subheading: "Sports, art, science & so much more — every single day", label: "Book your weeks" }), B("band", { heading: "⚡ Early-bird ends Sunday — save 15%", label: "Grab the offer" }), B("heading", { heading: "A different adventure every day", subheading: "One booking, endless fun" }), B("cards", { cols: 3, cards: [C("Sports & Games", "Football, dodgeball, archery"), C("Arts & Crafts", "Paint, print, create"), C("Science Lab", "Slime, rockets, experiments"), C("Go-Karting", "On our safe track"), C("Bouncy Castles", "Inflatable Fridays!"), C("Cooking", "Bake & take home")] }), B("split", { heading: "Care to suit your day", body: "Free early drop-off from 8am and late pick-up until 6pm — camp that works around work.", label: "See the times" }), B("tiers", { cards: [C("1 Day", "Try us out", "£28", "Book"), C("3 Days", "Most popular", "£75", "Book"), C("Full Week", "Best value", "£120", "Book")] }), B("text", { body: "All staff are DBS-checked, first-aid trained and brilliant with children. Small group ratios mean everyone gets a look-in." }), B("button", { label: "Book your summer now" }), soc(), foot()] },
  { id: "refer", name: "Refer a friend", category: "Offers & bookings", accentId: "mint", blocks: () => [H("Rewards"), B("hero", { heading: "Bring a friend, both get rewarded", subheading: "Sharing the fun pays off", label: "Get your link" }), B("band", { heading: "£10 for you, £10 for them — every time" }), B("heading", { heading: "How it works" }), B("cards", { cols: 3, cards: [C("1. Share", "Send your unique link to a friend"), C("2. They book", "They join any camp or club"), C("3. You both save", "£10 off each — no limit!")] }), B("split", { flip: true, heading: "Why families love us", body: "From multi-activity camps to our coding club and go-karting, there's something every child loves — and every parent trusts." }), B("button", { label: "Share & save" }), soc(), foot()] },
  { id: "price-list", name: "Sessions & prices", category: "Offers & bookings", accentId: "green", blocks: () => [H("Book online & save 10%"), B("heading", { heading: "What's on & what it costs" }), B("cards", { cols: 3, cards: [C("Multi-Activity Camp", "Full day, all ages", "From £28/day"), C("Sports Camp", "Football & more", "From £24/day"), C("Art & Craft Club", "After school", "From £12")] }), B("cards", { cols: 3, cards: [C("IT & Coding Club", "Minecraft & robotics", "From £14"), C("Go-Karting", "Weekend sessions", "From £18"), C("Bouncy Castle Party", "Book the whole set", "From £120")] }), B("divider"), B("split", { heading: "Our booking policies", body: "Places are held on payment. Late collections are charged per the posted rate. Full terms are on our website." }), B("button", { label: "Book online now" }), soc(), foot()] },
  { id: "clubs-showcase", name: "After-school clubs", category: "Offers & bookings", accentId: "coral", blocks: () => [B("hero", { heading: "After-School Clubs are back", subheading: "A brilliant end to every school day" }), B("band", { heading: "20% off when you book a full term" }), B("heading", { heading: "Pick your child's passion" }), B("cards", { cols: 3, cards: [C("Football", "Mon & Wed"), C("Dance & Drama", "Tuesdays"), C("Art & Craft", "Thursdays"), C("Coding Club", "Fridays"), C("Multi-Sports", "Daily"), C("Science", "Wednesdays")] }), B("split", { flip: true, heading: "Wraparound made easy", body: "Clubs run straight from the school bell to 6pm, so pick-up fits around you.", label: "See the timetable" }), B("button", { label: "Reserve a place" }), soc(), foot()] },
  { id: "tiers", name: "Course / pricing tiers", category: "Offers & bookings", accentId: "red", blocks: () => [B("hero", { heading: "Holiday Coaching Courses", subheading: "Intensive skills, serious fun" }), B("text", { body: "Led by qualified coaches, our holiday courses build real skills across a week — and finish with a celebration your child will remember." }), B("tiers", { cards: [C("1 Week", "Mornings only", "£100", "Book"), C("2 Weeks", "Full days", "£189", "Book"), C("3 Weeks", "Full + care", "£289", "Book")] }), B("band", { heading: "Sibling discount — 10% off the second child" }), B("button", { label: "See all courses" }), soc(), foot()] },
  { id: "early-bird", name: "Early-bird offer", category: "Offers & bookings", accentId: "blue", blocks: () => [H("Early-bird"), B("heading", { heading: "Book by Sunday & save 20%" }), B("text", { body: "Beat the rush and lock in the best rate of the year across every camp and club." }), B("cards", { cols: 3, cards: [C("Multi-Activity", "All week", "£96"), C("Sports Camp", "Football focus", "£88"), C("Art Camp", "Messy & fun", "£84")] }), B("band", { heading: "⏳ Early-bird ends Sunday midnight", label: "Book & save" }), soc(), foot()] },
  { id: "flash", name: "Flash sale", category: "Offers & bookings", accentId: "red", blocks: () => [B("band", { heading: "48-HOUR FLASH SALE — 20% OFF EVERYTHING" }), B("hero", { heading: "This weekend only", subheading: "One code, every camp & club", label: "Shop the sale" }), B("cards", { cols: 2, cards: [C("Holiday Club week", "", "was £120 now £96"), C("Go-Karting session", "", "was £18 now £14")] }), B("text", { body: "Use code WEEKEND at checkout. One per family, ends Sunday at midnight." }), soc(), foot()] },
  { id: "birthday", name: "Birthday parties", category: "Offers & bookings", accentId: "pink", blocks: () => [B("hero", { heading: "Party with us!", subheading: "Bouncy castles, games & zero stress for you" }), B("heading", { heading: "Pick your party" }), B("cards", { cols: 3, cards: [C("Bouncy Castle", "Inflatable fun", "From £120"), C("Multi-Sports", "Games galore", "From £150"), C("Arts & Crafts", "Make & take", "From £130")] }), B("split", { flip: true, heading: "We bring the energy", body: "You bring the birthday child — we handle games, kit and clean-up. Just add cake!", label: "Check a date" }), B("button", { label: "Enquire now" }), soc(), foot()] },

  { id: "open-day", name: "Open day invite", category: "Announcements", accentId: "navy", blocks: () => [H("You're invited"), B("hero", { heading: "Come and try us — free!", subheading: "See the camps, meet the team" }), B("heading", { heading: "What's on" }), B("cards", { cols: 3, cards: [C("Sports Taster", "10:00–11:00"), C("Craft Corner", "11:00–12:00"), C("Coding Demo", "12:00–13:00")] }), B("split", { heading: "Bring the whole family", body: "Free entry, free tasters and a chance to grab an early-bird place before summer sells out." }), B("button", { label: "Let us know you're coming" }), soc(), foot()] },
  { id: "new-venue", name: "New venue opening", category: "Announcements", accentId: "coral", blocks: () => [B("hero", { heading: "A brand-new venue!", subheading: "More space, more activities, closer to home" }), B("text", { body: "From September you'll find our multi-activity camps and clubs at a fantastic new site — bigger halls, more outdoor space, and room for the go-karts!" }), B("image", { size: "full", caption: "Our brilliant new home" }), B("cards", { cols: 3, cards: [C("Sports Hall", "Rain-proof fun"), C("Art Studio", "Space to create"), C("Outdoor Track", "Go-karts & games")] }), B("button", { label: "See the venue" }), soc(), foot()] },
  { id: "showcase", name: "Everything we offer", category: "Announcements", accentId: "blue", blocks: () => [H(), B("heading", { heading: "Something for every child" }), B("cards", { cols: 3, cards: [C("Multi-Activity Camp", "The all-rounder"), C("Sports Camp", "Football & more"), C("Art & Craft Club", "Get creative"), C("IT & Coding Club", "Minecraft & robots"), C("Go-Karting", "On our track"), C("Forest School", "Outdoor adventures")] }), B("split", { flip: true, heading: "One provider, endless days out", body: "Term-time clubs, holiday camps, wraparound care and parties — all under one trusted roof." }), B("button", { label: "Explore everything" }), soc(), foot()] },
  { id: "fixture", name: "Match / event day", category: "Announcements", accentId: "green", blocks: () => [H("Match day"), B("hero", { heading: "Friendly Football Match Day", subheading: "Come and cheer them on!" }), B("cards", { cols: 3, cards: [C("Date", "Sat 14 Jun"), C("Kick-off", "10:00 AM"), C("Venue", "Main field")] }), B("text", { body: "Bring a chair, a snack and your loudest cheer. Squad sheets and team colours will follow nearer the day." }), B("button", { label: "Add to calendar" }), soc(), foot()] },
  { id: "anniversary", name: "Milestone / birthday", category: "Announcements", accentId: "purple", blocks: () => [B("hero", { heading: "Ten years of play!", subheading: "2016 – 2026" }), B("text", { body: "A decade of muddy knees, painted hands, coding wins and go-kart grins. Thank you for being part of the adventure." }), B("image", { size: "full" }), B("band", { heading: "🎉 Book this month & get a free party voucher" }), B("button", { label: "See how we've grown" }), soc(), foot()] },
  { id: "fundraiser", name: "Fundraiser", category: "Announcements", accentId: "red", blocks: () => [B("hero", { heading: "Help a child join the fun", subheading: "Our free-places fund is open" }), B("text", { body: "Every family deserves a brilliant summer. Our fund gives free camp places to children who'd otherwise miss out." }), B("cards", { cols: 3, cards: [C("£10", "A day of sports"), C("£25", "A creative workshop"), C("£120", "A whole camp week")] }), B("band", { heading: "Every booking this month adds to the fund", label: "Get involved" }), soc(), foot()] },

  { id: "welcome", name: "Welcome pack", category: "Welcome", accentId: "teal", blocks: () => [H(), B("hero", { heading: "Welcome to the club!", subheading: "We can't wait to meet your family" }), B("text", { body: "Here's everything you need for a brilliant first day at camp." }), B("cards", { cols: 2, cards: [C("What to bring", "Packed lunch, water, sun cream, a coat & a smile"), C("Drop-off & pick-up", "Doors open 8:45am · collect by 3:30pm (or use late care)")] }), B("split", { flip: true, heading: "A typical day", body: "Sports, arts, a big lunch, more activities and a calm wind-down — busy, happy and full of fun." }), B("button", { label: "View your booking" }), soc(), foot()] },
  { id: "what-to-bring", name: "Session reminder", category: "Welcome", accentId: "teal", blocks: () => [H("See you soon"), B("heading", { heading: "Your session is coming up!" }), B("text", { body: "A few reminders so the day runs smoothly for everyone." }), B("cards", { cols: 2, cards: [C("Please pack", "Labelled lunch, snacks, water & weather-ready clothes"), C("Good to know", "No nuts on site. Tell us of any changes to collection.")] }), B("band", { heading: "Running late? Just give us a ring." }), foot()] },
  { id: "meet-team", name: "Meet the team", category: "Welcome", accentId: "purple", blocks: () => [H(), B("heading", { heading: "Meet the people behind the fun" }), B("cards", { cols: 3, cards: [C("Sam", "Camp Manager"), C("Priya", "Forest School Lead"), C("Jordan", "Head Sports Coach")] }), B("text", { body: "Every one of our team is DBS-checked, first-aid trained and genuinely brilliant with children. Say hello at drop-off — they'd love to meet you." }), B("image", { size: "m" }), soc(), foot()] },

  { id: "weekly", name: "Weekly round-up", category: "News & updates", accentId: "purple", blocks: () => [H("This week"), B("heading", { heading: "This week at camp" }), B("split", { heading: "Mini-Olympics madness", body: "Medals, mud and a whole lot of laughing — the children smashed every event." }), B("split", { flip: true, heading: "Coding club creations", body: "Our IT club built their first working games. Proud doesn't cover it." }), B("image", { size: "full", caption: "Snapshot of the week" }), B("band", { heading: "Next week's places are filling fast", label: "See what's on" }), soc(), foot()] },
  { id: "photo-story", name: "Photo story", category: "News & updates", accentId: "amber", blocks: () => [H(), B("image", { size: "full" }), B("heading", { heading: "What a week we've had!" }), B("text", { body: "From den-building in Forest School to go-kart races and a very messy art day — the children packed a lot in." }), B("image", { size: "full" }), B("split", { heading: "More on your app", body: "Every photo from the week is waiting in your parent app — take a look!" }), foot()] },
  { id: "term-dates", name: "Term & camp dates", category: "News & updates", accentId: "teal", blocks: () => [H(), B("heading", { heading: "Dates for your diary" }), B("cards", { cols: 3, cards: [C("Autumn Clubs", "2 Sep – 20 Dec"), C("October Camp", "27–31 Oct"), C("Spring Clubs", "6 Jan – 4 Apr"), C("Feb Camp", "16–20 Feb"), C("Summer Camp", "21 Jul – 29 Aug"), C("INSET Cover", "Dates TBC")] }), B("band", { heading: "Book all six weeks & save 15%", label: "Book ahead" }), foot()] },
  { id: "menu", name: "Menu / meals update", category: "News & updates", accentId: "green", blocks: () => [H(), B("heading", { heading: "Freshly refreshed camp menu" }), B("cards", { cols: 3, cards: [C("Monday", "Pasta & garlic bread"), C("Wednesday", "Chicken wraps & salad"), C("Friday", "Fish & chips")] }), B("text", { body: "All meals are allergen-friendly and child-approved. Let us know of any dietary needs and we'll always cater for them." }), soc(), foot()] },
  { id: "tips", name: "Parent tips", category: "News & updates", accentId: "teal", blocks: () => [H(), B("heading", { heading: "5 ways to make camp mornings easier" }), B("text", { body: "1. Pack the night before — bag, kit, lunch, done.\n\n2. Name everything (labels beat lost-property tears).\n\n3. Give little jobs to build independence.\n\n4. Keep it calm — a five-minute head start beats a ten-minute rush.\n\n5. Talk about the fun ahead on the way in." }), B("band", { heading: "Got a tip of your own? Reply and tell us!" }), foot()] },
  { id: "review", name: "Review request", category: "News & updates", accentId: "blue", blocks: () => [H(), B("heading", { heading: "How did we do?" }), B("text", { body: "We'd love a quick word on how your child found their camp or club. It takes a minute and genuinely helps other families choose us." }), B("button", { label: "Leave a review" }), soc(), foot()] },
  { id: "survey", name: "Survey invite", category: "News & updates", accentId: "purple", blocks: () => [H(), B("band", { heading: "Two minutes to shape next term?" }), B("text", { body: "We're planning next term's camps and clubs — venues, times, activities, the lot. Your view genuinely steers it." }), B("button", { label: "Take the survey" }), foot()] },

  { id: "seasonal", name: "Seasonal greeting", category: "Seasonal", accentId: "red", blocks: () => [B("hero", { heading: "Season's greetings", subheading: "from all of us at the club" }), B("text", { body: "Wishing your family a wonderful holiday and a happy, healthy new year. Thank you for a brilliant year of camps and clubs." }), B("band", { heading: "🎁 New-year camp places are open now", label: "Book the holidays" }), soc(), foot()] },
  { id: "end-term", name: "End-of-term thanks", category: "Seasonal", accentId: "amber", blocks: () => [H(), B("heading", { heading: "Thank you for a brilliant term!" }), B("text", { body: "Rest up, have fun, and we'll see you at the next camp. It's been a joy watching every child grow, giggle and go for it." }), B("image", { size: "full" }), B("band", { heading: "Holiday camp places are filling fast", label: "Book now" }), foot()] },
  { id: "star", name: "Star of the week", category: "Seasonal", accentId: "pink", blocks: () => [B("band", { heading: "⭐ Star of the Week ⭐" }), B("heading", { heading: "Kindness, effort and the biggest smile" }), B("text", { body: "We love celebrating the little wins at camp. Ask your child about their star moment this week!" }), B("image", { size: "m" }), foot()] },

  { id: "payment", name: "Payment reminder", category: "Admin & notices", accentId: "navy", blocks: () => [H(), B("heading", { heading: "A friendly payment reminder" }), B("text", { body: "Your balance for the upcoming camp is due soon. You can pay securely in your parent account — just a nudge so your child's place stays held." }), B("button", { label: "Pay securely" }), foot()] },
  { id: "closure", name: "Closure / change notice", category: "Admin & notices", accentId: "red", blocks: () => [H("Important"), B("heading", { heading: "An update to your session" }), B("text", { body: "Due to circumstances beyond our control, the session on this date won't run as planned. We're sorry for any disruption — affected families will be contacted directly about options and refunds." }), foot()] },
  { id: "price-update", name: "Price update", category: "Admin & notices", accentId: "navy", blocks: () => [H(), B("heading", { heading: "A note on our prices" }), B("text", { body: "From the new term our camp and club prices will change slightly, so we can keep our ratios small and our team brilliant. Full details are in your account — thank you for your continued support." }), foot()] },
];

export const CATEGORIES = ["Offers & bookings", "Announcements", "Welcome", "News & updates", "Seasonal", "Admin & notices"];
export const templateOf = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
// A block's width as a fraction of the row.
export const widthOf = (b: Block) => (b.span === "half" ? 0.5 : b.span === "third" ? 1 / 3 : 1);
// Flow blocks into rows: full = its own row; half/third pack together until the row is full.
export function groupRows(blocks: Block[]): Block[][] {
  const rows: Block[][] = []; let cur: Block[] = []; let sum = 0;
  for (const b of blocks) {
    const w = widthOf(b);
    if (w >= 1) { if (cur.length) { rows.push(cur); cur = []; sum = 0; } rows.push([b]); continue; }
    if (sum + w > 1.001) { rows.push(cur); cur = []; sum = 0; }
    cur.push(b); sum += w;
  }
  if (cur.length) rows.push(cur);
  return rows;
}
export function renderDesignHtml(d: CampaignDesign, c?: Partial<Company>, now = 0): string {
  const t = theme(accentHex(d.accent) || d.accent);
  const html = groupRows(d.blocks || []).map((grp) => {
    if (grp.length === 1 && widthOf(grp[0]) >= 1) return renderBlock(grp[0], t, c, now);
    let used = 0;
    const cells = grp.map((g) => { const w = Math.round(widthOf(g) * 100); used += w; return `<td valign="top" width="${w}%" style="vertical-align:top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%">${renderBlock(g, t, c, now)}</table></td>`; }).join("");
    const spacer = used < 99 ? `<td width="${100 - used}%">&nbsp;</td>` : "";
    return `<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%"><tr>${cells}${spacer}</tr></table></td></tr>`;
  }).join("");
  return wrapRows(html);
}
export function renderDesignText(d: CampaignDesign): string { const out: string[] = []; for (const b of d.blocks || []) { [b.heading, b.subheading, b.body, b.label].forEach((s) => { if (s && s.trim()) out.push(s.trim()); }); (b.cards || []).forEach((cd) => { [cd.title, cd.caption, cd.price].forEach((s) => { if (s && s.trim()) out.push(s.trim()); }); }); } return out.join("\n\n"); }
const withSocials = (blocks: Block[], seed?: Social[]): Block[] => (seed && seed.length ? blocks.map((b) => (b.t === "social" && (!b.socials || b.socials.every((s) => !s.url)) ? { ...b, socials: seed } : b)) : blocks);
const fillCo = (s: string | undefined, name?: string) => (s && s.includes("{company}") ? s.replace(/\{company\}/g, name || "us") : s);
export const newDesign = (templateId: string, c?: Partial<Company>, seed?: Social[]): CampaignDesign => { const t = templateOf(templateId); const name = c?.name || undefined; const blocks = withSocials(t.blocks(), seed).map((b) => { const bb = (b.t === "header" || b.t === "footer") && !b.heading ? { ...b, heading: name || "" } : { ...b }; return { ...bb, heading: fillCo(bb.heading, name), subheading: fillCo(bb.subheading, name), body: fillCo(bb.body, name), caption: fillCo(bb.caption, name) }; }); return { templateId, accent: t.accentId, blocks }; };

// ── block palette for "add section" — ready-made sections with lovely layout ─
const ADDABLE: { icon: string; label: string; hint: string; make: () => Block | Block[] }[] = [
  { icon: "🖼", label: "Big hero", hint: "Image + headline + button", make: () => B("hero", { heading: "A brilliant headline", subheading: "A supporting line to set the scene", label: "Book now" }) },
  { icon: "🏷", label: "Logo", hint: "Your saved business logo", make: () => B("logo", { size: "m", align: "center" }) },
  { icon: "⭐", label: "Testimonial", hint: "A 5-star parent review", make: () => B("quote", { body: "Absolutely brilliant — my two had the best week ever and can't wait to go back!", heading: "— Sarah, mum of two" }) },
  { icon: "📊", label: "Stats row", hint: "Big numbers that impress", make: () => [B("heading", { heading: "Trusted by families" }), B("stats", { cards: [{ title: "2,000+", caption: "happy children" }, { title: "12", caption: "venues" }, { title: "10 yrs", caption: "of adventures" }] })] },
  { icon: "✅", label: "What's included", hint: "A tick-list of perks", make: () => B("checklist", { heading: "Every day includes", item1: "Qualified, DBS-checked coaches", item2: "A hot lunch & snacks", item3: "Free early & late care", item4: "All equipment provided" }) },
  { icon: "🎟", label: "Discount code", hint: "A promo code box", make: () => B("code", { subheading: "Use code", heading: "SUMMER15", body: "15% off your next booking — this week only." }) },
  { icon: "📞", label: "Contact strip", hint: "Phone · email · address", make: () => B("contact", { heading: "Get in touch" }) },
  { icon: "⏰", label: "Countdown timer", hint: "Counts down to your date", make: () => B("countdown", { heading: "Early-bird ends in", label: "Book before it's gone" }) },
  { icon: "📈", label: "Graph", hint: "A fancy bar chart", make: () => B("graph", { heading: "Our year in numbers", cards: [C("Camps run", "", "48"), C("Happy kids", "", "2000"), C("5-star reviews", "", "480")].map((cd) => ({ title: cd.title, caption: cd.price })) }) },
  { icon: "✍️", label: "Heading", hint: "A titled section", make: () => B("heading", { heading: "Section heading", subheading: "An optional supporting line" }) },
  { icon: "📝", label: "Text", hint: "A paragraph (+ optional button)", make: () => B("text", { body: "Write your message here." }) },
  { icon: "🏞", label: "Image + text", hint: "Photo beside words", make: () => B("split", { heading: "Tell them about it", body: "A short, friendly paragraph that sits neatly beside the photo.", label: "Find out more" }) },
  { icon: "🌟", label: "Feature trio", hint: "3 selling points", make: () => [B("heading", { heading: "Why families love us" }), B("cards", { cols: 3, cards: [C("Qualified team", "DBS-checked & first-aid trained"), C("Small groups", "More attention for every child"), C("Easy booking", "Secure a place in minutes")] })] },
  { icon: "🎨", label: "Activity grid", hint: "6 activities", make: () => [B("heading", { heading: "Something for everyone" }), B("cards", { cols: 3, cards: [C("Multi-Sports"), C("Arts & Crafts"), C("Coding Club"), C("Go-Karting"), C("Forest School"), C("Bouncy Castles")] })] },
  { icon: "📸", label: "Photo gallery", hint: "Heading + 3 photos", make: () => [B("heading", { heading: "Moments from camp" }), B("collage", { cols: 3, cards: [{ image: "" }, { image: "" }, { image: "" }] })] },
  { icon: "🖼", label: "3 photos in a row", hint: "Triple image strip", make: () => B("collage", { cols: 3, cards: [{ image: "" }, { image: "" }, { image: "" }] }) },
  { icon: "🧩", label: "Photo collage", hint: "Big + two stacked", make: () => B("collage", { cards: [{ image: "" }, { image: "" }, { image: "" }] }) },
  { icon: "💷", label: "Pricing section", hint: "3 price tiers", make: () => [B("heading", { heading: "Simple pricing" }), B("tiers", { cards: [C("1 Day", "Try us out", "£28", "Book"), C("3 Days", "Most popular", "£75", "Book"), C("Full Week", "Best value", "£120", "Book")] })] },
  { icon: "🪜", label: "How it works", hint: "3 easy steps", make: () => [B("heading", { heading: "How it works" }), B("cards", { cols: 3, cards: [C("1. Choose", "Pick your camp or club"), C("2. Book", "Secure a place online"), C("3. Enjoy", "We take it from there")] })] },
  { icon: "⚡", label: "Highlight offer", hint: "Colour band + button", make: () => B("band", { heading: "⚡ Early-bird ends Sunday — save 15%", label: "Grab the offer" }) },
  { icon: "📣", label: "Call to action", hint: "Panel + button", make: () => [B("band", { heading: "Ready to book?", body: "Places are filling fast — grab yours today.", label: "Book now" })] },
  { icon: "🔘", label: "Button", hint: "A single link", make: () => B("button", { label: "Book now", url: "" }) },
  { icon: "📱", label: "Social icons", hint: "Your profiles", make: () => soc() },
  { icon: "➖", label: "Divider", hint: "A thin line", make: () => B("divider") },
  { icon: "📍", label: "Footer", hint: "Name + address", make: () => foot() },
];
const BLOCK_LABEL: Record<BlockType, string> = { header: "Header", logo: "Logo", hero: "Hero", band: "Colour band", heading: "Heading", text: "Text", image: "Image", cards: "Cards", tiers: "Pricing tiers", split: "Image + text", button: "Button", social: "Social icons", divider: "Divider", footer: "Footer", quote: "Testimonial", stats: "Stats", checklist: "Checklist", code: "Discount code", contact: "Contact strip", countdown: "Countdown timer", graph: "Graph", collage: "Photo collage" };

// ── crop control — drag anywhere to reposition (object-position pan) + zoom ───
const clamp01 = (v: number) => Math.max(0, Math.min(100, v));
function CropBox({ url, ix = 50, iy = 50, iz = 1, onChange }: { url: string; ix?: number; iy?: number; iz?: number; onChange: (p: { ix?: number; iy?: number; iz?: number }) => void }) {
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; w: number; h: number } | null>(null);
  const down = (e: RPE<HTMLDivElement>) => { drag.current = { sx: e.clientX, sy: e.clientY, x: ix, y: iy, w: e.currentTarget.clientWidth || 1, h: e.currentTarget.clientHeight || 1 }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e: RPE<HTMLDivElement>) => { const d = drag.current; if (!d) return; onChange({ ix: clamp01(d.x - ((e.clientX - d.sx) / d.w) * 100), iy: clamp01(d.y - ((e.clientY - d.sy) / d.h) * 100) }); };
  const up = () => { drag.current = null; };
  return (
    <div className="space-y-1.5">
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} className="relative h-44 w-full cursor-move touch-none select-none overflow-hidden rounded-lg bg-[#0b1020]">
        <img src={url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${ix}% ${iy}%`, transform: `scale(${iz})`, transformOrigin: `${ix}% ${iy}%` }} />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">✥ drag to reposition</span>
      </div>
      <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-[var(--ink-3)]">Zoom</span><input type="range" min={1} max={3} step={0.02} value={iz} onChange={(e) => onChange({ iz: Number(e.target.value) })} className="flex-1" /><span className="w-8 text-right text-[10px] tabular-nums text-[var(--ink-3)]">{iz.toFixed(1)}×</span></div>
    </div>
  );
}

// ── designer ─────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]";
const lbl = "mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]";

export function CampaignDesigner({ initial, company, socials, onCancel, onSave }: { initial?: CampaignDesign | null; company?: Partial<Company>; socials?: Social[]; onCancel: () => void; onSave: (d: CampaignDesign) => void }) {
  const uid = useRef(1000);
  const nk = () => `b${uid.current++}`;
  const [design, setDesign] = useState<CampaignDesign | null>(() => (initial ? { ...initial, blocks: withSocials(initial.blocks, socials).map((b, i) => ({ ...b, k: `i${i}` })) } : null));
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addIndex, setAddIndex] = useState<number | null>(null);
  const [pendingSpan, setPendingSpan] = useState<"half" | "third" | null>(null);
  const [selKey, setSelKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [colourOpen, setColourOpen] = useState(false);
  const [history, setHistory] = useState<CampaignDesign[]>([]);
  const [future, setFuture] = useState<CampaignDesign[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNowMs(Date.now()), 1000); return () => clearInterval(id); }, []);
  const [codes, setCodes] = useState<string[]>([]);
  useEffect(() => { apiGet<{ code?: string }[]>("/api/discounts").then((r) => setCodes([...new Set((r || []).map((x) => x.code).filter((x): x is string => !!x))])).catch(() => {}); }, []);

  const tpl = design ? templateOf(design.templateId || "") : null;
  const shown = TEMPLATES.filter((t) => t.category === cat);
  const selBlock = design ? (design.blocks.find((b) => b.k === selKey) ?? null) : null;
  const t2 = theme(accentHex(design?.accent || "blue") || (design?.accent || "blue"));
  const ctrlBtn = "flex h-6 w-6 items-center justify-center rounded text-[13px] font-bold text-[#33456b] hover:bg-[#e7ecf4] disabled:opacity-30";
  const start = (id: string) => { const d = newDesign(id, company, socials); setHistory([]); setFuture([]); setDesign({ ...d, blocks: d.blocks.map((b) => ({ ...b, k: nk() })) }); };
  const snapshot = () => { setHistory((h) => (design ? [...h.slice(-49), design] : h)); setFuture([]); };
  const undo = () => { if (!history.length || !design) return; setFuture((f) => [design, ...f].slice(0, 50)); setDesign(history[history.length - 1]); setHistory((h) => h.slice(0, -1)); setSelKey(null); setAddOpen(false); };
  const redo = () => { if (!future.length || !design) return; setHistory((h) => [...h.slice(-49), design]); setDesign(future[0]); setFuture((f) => f.slice(1)); setSelKey(null); setAddOpen(false); };
  const setBlocks = (fn: (bs: Block[]) => Block[]) => { snapshot(); setDesign((d) => (d ? { ...d, blocks: fn(d.blocks) } : d)); };
  const patch = (k: string, p: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.k === k ? { ...b, ...p } : b)));
  const move = (k: string, dir: -1 | 1) => setBlocks((bs) => { const i = bs.findIndex((b) => b.k === k); const j = i + dir; if (i < 0 || j < 0 || j >= bs.length) return bs; const n = [...bs]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const dup = (k: string) => setBlocks((bs) => { const i = bs.findIndex((b) => b.k === k); if (i < 0) return bs; return [...bs.slice(0, i + 1), { ...bs[i], k: nk(), cards: bs[i].cards ? bs[i].cards!.map((c) => ({ ...c })) : undefined }, ...bs.slice(i + 1)]; });
  const del = (k: string) => { setBlocks((bs) => bs.filter((b) => b.k !== k)); setSelKey((s) => (s === k ? null : s)); };
  const addAt = (mk: () => Block | Block[], index: number) => { const made = mk(); const arr = (Array.isArray(made) ? made : [made]).map((x, idx) => { const nb = { ...x, k: nk() }; if (nb.t === "social" && socials?.length) nb.socials = socials; if (idx === 0 && pendingSpan) nb.span = pendingSpan; return nb; }); setBlocks((bs) => [...bs.slice(0, index), ...arr, ...bs.slice(index)]); setAddOpen(false); setAddIndex(null); setPendingSpan(null); if (arr[0]?.k) setSelKey(arr[0].k); };
  const aiWrite = async (bk: string, key: keyof Block, ctx?: string) => {
    const brief = typeof window !== "undefined" ? window.prompt("In a few words, what should this say? The writer turns it into friendly copy.", ctx || "") : null;
    if (!brief?.trim()) return; setAiBusy(`${bk}-${String(key)}`);
    try { const r = await apiPost<{ title: string; body: string }>("/api/ai/compose", { kind: "announce", notes: brief.trim(), length: "medium" }); if (r.body) patch(bk, { [key]: r.body } as Partial<Block>); } catch { /* ignore */ } setAiBusy(null);
  };
  const setCard = (bk: string, ci: number, p: Partial<Card>) => setBlocks((bs) => bs.map((b) => (b.k === bk ? { ...b, cards: (b.cards || []).map((c, i) => (i === ci ? { ...c, ...p } : c)) } : b)));
  const addCard = (bk: string) => setBlocks((bs) => bs.map((b) => (b.k === bk ? { ...b, cards: [...(b.cards || []), C("New", "", "")] } : b)));
  const delCard = (bk: string, ci: number) => setBlocks((bs) => bs.map((b) => (b.k === bk ? { ...b, cards: (b.cards || []).filter((_, i) => i !== ci) } : b)));
  const upload = async (key: string, apply: (url: string) => void, file: File) => { setBusyKey(key); try { const small = await downscaleImage(file); const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl: small }); apply(url); } catch { /* ignore */ } setBusyKey(null); };

  const imgField = (id: string, o: { image?: string; video?: string; ix?: number; iy?: number; iz?: number }, apply: (p: Partial<Block> & Partial<Card>) => void) => (
    <div className="space-y-1.5">
      {o.image
        ? <div className="space-y-1.5"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-[var(--ink-3)]">{o.video ? "Poster image — drag to crop" : "Image — drag to crop"}</span><button type="button" onClick={() => apply({ image: "", ix: 50, iy: 50, iz: 1 })} className="text-[11px] font-bold text-[#c02636]">Remove</button></div><CropBox url={o.image} ix={o.ix} iy={o.iy} iz={o.iz} onChange={apply} /></div>
        : <div className="flex flex-wrap items-center gap-1.5"><label className="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{busyKey === id ? "…" : "⬆ Add image"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(id, (u) => apply({ image: u }), f); e.target.value = ""; }} /></label><input placeholder="or paste URL" value={o.image ?? ""} onChange={(e) => apply({ image: e.target.value })} className={`${inputCls} min-w-[110px] flex-1`} /></div>}
      <input placeholder="🎬 Video link — YouTube or a direct .mp4" value={o.video ?? ""} onChange={(e) => apply({ video: e.target.value })} className={inputCls} />
      {o.video && <div className="text-[10px] font-semibold text-[#127a3e]">A <b>direct .mp4</b> plays inline (Apple Mail / most webmail). A <b>YouTube</b> link shows a play thumbnail that opens the video — its thumbnail is used automatically if you don&apos;t add a poster image.</div>}
    </div>
  );

  const blockEditor = (b: Block) => {
    const k = b.k!;
    const hd = (label: string, val?: string, key: keyof Block = "heading") => <div><div className={lbl}>{label}</div><input value={(val ?? "") as string} onChange={(e) => patch(k, { [key]: e.target.value })} className={inputCls} /></div>;
    const ta = (label: string, key: keyof Block = "body") => <div><div className="mb-0.5 flex items-center gap-2"><span className={lbl.replace("mb-0.5 ", "")}>{label}</span><button type="button" onClick={() => aiWrite(k, key, b.heading)} className="ml-auto text-[10.5px] font-extrabold text-[#7c3aed] hover:underline">{aiBusy === `${k}-${String(key)}` ? "✨ Writing…" : "✨ Help me write"}</button></div><textarea rows={3} value={(b[key] ?? "") as string} onChange={(e) => patch(k, { [key]: e.target.value })} className={inputCls} /></div>;
    switch (b.t) {
      case "header": return <div className="space-y-1.5">{hd("Business name", b.heading)}{hd("Tagline (optional)", b.subheading, "subheading")}</div>;
      case "hero": return <div className="space-y-1.5"><div><div className={lbl}>Image</div>{imgField(`${k}-img`, b, (p) => patch(k, p))}</div>{hd("Heading", b.heading)}{hd("Sub-heading", b.subheading, "subheading")}{ta("Body")}{hd("Button label (blank = none)", b.label, "label")}{hd("Button link", b.url, "url")}</div>;
      case "band": return <div className="space-y-1.5">{hd("Heading", b.heading)}{ta("Text (optional)")}{hd("Button label (blank = none)", b.label, "label")}{hd("Button link", b.url, "url")}</div>;
      case "heading": return <div className="space-y-1.5">{hd("Heading", b.heading)}{hd("Sub-heading (optional)", b.subheading, "subheading")}{hd("Button label (optional — e.g. Book now)", b.label, "label")}{hd("Button link", b.url, "url")}</div>;
      case "text": return <div className="space-y-1.5">{ta("Text")}{hd("Button label (optional — e.g. Book now)", b.label, "label")}{hd("Button link", b.url, "url")}</div>;
      case "image": { const beside = b.size !== "full"; return <div className="space-y-2">{imgField(`${k}-img`, b, (p) => patch(k, p))}
        <div><div className={lbl}>Shape</div><div className="flex flex-wrap gap-1">{([["landscape", "Rectangle"], ["square", "Square"], ["portrait", "Portrait"], ["wide", "Banner"]] as const).map(([s, l]) => <button key={s} type="button" onClick={() => patch(k, { shape: s })} className={`rounded px-2 py-1 text-[11px] font-bold ${(b.shape || "landscape") === s ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{l}</button>)}</div></div>
        <div className="flex items-start gap-4"><div><div className={lbl}>Size</div><div className="flex gap-1">{(["s", "m", "full"] as const).map((s) => <button key={s} type="button" onClick={() => patch(k, { size: s })} className={`rounded px-2 py-1 text-[11px] font-bold ${b.size === s ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{s === "s" ? "Small" : s === "m" ? "Medium" : "Full"}</button>)}</div></div><div><div className={lbl}>{beside && (b.heading || b.body) ? "Image side" : "Align"}</div><div className="flex gap-1">{(["left", "center", "right"] as const).map((al) => <button key={al} type="button" onClick={() => patch(k, { align: al })} className={`rounded px-2 py-1 text-[11px] font-bold ${(b.align || "center") === al ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{al[0].toUpperCase()}</button>)}</div></div></div>
        {beside ? <div className="space-y-1.5 rounded-lg border border-dashed border-[#bcd3f5] bg-[#f6f9ff] p-2.5"><div className="text-[11px] font-bold text-[#1d3a8f]">✎ Text beside the image <span className="font-normal text-[var(--ink-3)]">— there&apos;s room, so fill it (optional)</span></div>{hd("Heading", b.heading)}{ta("Body")}{(b.heading || b.body) && <div><div className={lbl}>Image / text split — drag to keep the image bigger</div><input type="range" min={25} max={70} step={1} value={b.splitPct ?? (b.size === "s" ? 38 : 52)} onChange={(e) => patch(k, { splitPct: Number(e.target.value) })} className="w-full" /><div className="text-[10px] text-[var(--ink-3)]">Image {b.splitPct ?? (b.size === "s" ? 38 : 52)}% · text fills the rest</div></div>}</div> : <div className="text-[10.5px] text-[var(--ink-3)]">Tip: switch to Small or Medium and a text area appears to sit beside the image.</div>}
        {hd("Button label (optional — e.g. Book now)", b.label, "label")}{hd("Button link", b.url, "url")}
        {hd("Caption (optional)", b.caption, "caption")}</div>; }
      case "split": return <div className="space-y-1.5">{imgField(`${k}-img`, b, (p) => patch(k, p))}<label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={!!b.flip} onChange={(e) => patch(k, { flip: e.target.checked })} /> Image on the right</label>{hd("Heading", b.heading)}{ta("Body")}{hd("Button label (blank = none)", b.label, "label")}{hd("Button link", b.url, "url")}</div>;
      case "button": return <div className="space-y-1.5">{hd("Label", b.label, "label")}{hd("Link", b.url, "url")}</div>;
      case "footer": return <div className="space-y-1.5">{hd("Business name", b.heading)}{hd("Address line", b.body, "body")}</div>;
      case "divider": return <div className="text-[11.5px] text-[var(--ink-3)]">A thin divider line.</div>;
      case "social": {
        const list = b.socials && b.socials.length ? b.socials : DEFAULT_SOCIALS;
        const missing = SOC_NETS.filter((n) => !list.some((s) => s.net === n));
        const setList = (next: Social[]) => patch(k, { socials: next });
        return <div className="space-y-1.5">{hd("Caption (optional)", b.heading)}{list.map((s, i) => <div key={s.net + i} className="flex items-center gap-1.5"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: (SOC[s.net] || SOC.website).bg }}>{(SOC[s.net] || SOC.website).ch}</span><input placeholder={`${(SOC[s.net] || SOC.website).label} link`} value={s.url ?? ""} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={inputCls} /><button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[#c02636]">×</button></div>)}{missing.length > 0 && <select value="" onChange={(e) => { if (e.target.value) setList([...list, { net: e.target.value }]); }} className={inputCls}><option value="">＋ Add a network…</option>{missing.map((n) => <option key={n} value={n}>{SOC[n].label}</option>)}</select>}</div>;
      }
      case "cards":
      case "tiers": return <div className="space-y-2">{b.t === "cards" && <div className="flex items-center gap-2"><span className={lbl}>Columns</span>{[2, 3].map((n) => <button key={n} type="button" onClick={() => patch(k, { cols: n })} className={`rounded px-2 py-0.5 text-[11px] font-bold ${(b.cols || 3) === n ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{n}</button>)}</div>}
        {(b.cards || []).map((cd, i) => <div key={i} className="rounded-lg border border-[var(--line)] p-2"><div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold text-[var(--ink-3)]">Item {i + 1}</span><button type="button" onClick={() => delCard(k, i)} className="text-[11px] font-bold text-[#c02636]">Remove</button></div><div className="space-y-1"><input placeholder="Title" value={cd.title ?? ""} onChange={(e) => setCard(k, i, { title: e.target.value })} className={inputCls} /><input placeholder={b.t === "tiers" ? "Price (e.g. £100)" : "Caption"} value={(b.t === "tiers" ? cd.price : cd.caption) ?? ""} onChange={(e) => setCard(k, i, b.t === "tiers" ? { price: e.target.value } : { caption: e.target.value })} className={inputCls} />{b.t === "cards" && <input placeholder="Price (optional)" value={cd.price ?? ""} onChange={(e) => setCard(k, i, { price: e.target.value })} className={inputCls} />}{b.t === "tiers" && <input placeholder="What's included" value={cd.caption ?? ""} onChange={(e) => setCard(k, i, { caption: e.target.value })} className={inputCls} />}{b.t === "cards" && imgField(`${k}-c${i}`, cd, (p) => setCard(k, i, p))}<div className="grid grid-cols-2 gap-1"><input placeholder="Button (optional)" value={cd.label ?? ""} onChange={(e) => setCard(k, i, { label: e.target.value })} className={inputCls} /><input placeholder="Link" value={cd.url ?? ""} onChange={(e) => setCard(k, i, { url: e.target.value })} className={inputCls} /></div></div></div>)}
        {(b.cards?.length ?? 0) < 4 ? <button type="button" onClick={() => addCard(k)} className="rounded-lg border border-dashed border-[var(--line)] px-3 py-1.5 text-[11.5px] font-bold text-[#1d3a8f]">＋ Add item</button> : <div className="text-[10.5px] text-[var(--ink-3)]">Up to 4 per row.</div>}</div>;
      case "logo": return <div className="space-y-2"><div className="text-[11px] text-[var(--ink-3)]">Uses your saved business logo automatically. Upload a different image to override it here.</div>
        {b.image
          ? <div className="flex items-center gap-2"><img src={b.image} alt="" className="h-9 max-w-[120px] flex-none object-contain" /><button type="button" onClick={() => patch(k, { image: "" })} className="text-[11px] font-bold text-[#1d3a8f]">↩ Use saved logo</button></div>
          : <div className="flex flex-wrap items-center gap-1.5"><label className="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{busyKey === `${k}-logo` ? "…" : "⬆ Upload logo"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(`${k}-logo`, (u) => patch(k, { image: u }), f); e.target.value = ""; }} /></label><input placeholder="or paste URL" value={b.image ?? ""} onChange={(e) => patch(k, { image: e.target.value })} className={`${inputCls} min-w-[110px] flex-1`} /></div>}
        <div className="flex items-start gap-4"><div><div className={lbl}>Size</div><div className="flex gap-1">{(["s", "m", "full"] as const).map((s) => <button key={s} type="button" onClick={() => patch(k, { size: s })} className={`rounded px-2 py-1 text-[11px] font-bold ${(b.size || "m") === s ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{s === "s" ? "Small" : s === "m" ? "Medium" : "Large"}</button>)}</div></div><div><div className={lbl}>Align</div><div className="flex gap-1">{(["left", "center", "right"] as const).map((al) => <button key={al} type="button" onClick={() => patch(k, { align: al })} className={`rounded px-2 py-1 text-[11px] font-bold ${(b.align || "center") === al ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{al[0].toUpperCase()}</button>)}</div></div></div></div>;
      case "quote": return <div className="space-y-2">
        <div><div className={lbl}>Style</div><div className="flex flex-wrap gap-1">{([["centered", "❝ Centered"], ["card", "▢ Card"], ["minimal", "▌ Minimal"], ["avatar", "◍ Avatar"], ["bubble", "💬 Bubble"], ["banner", "▰ Banner"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => patch(k, { variant: v })} className={`rounded px-2 py-1 text-[11px] font-bold ${(b.variant || "centered") === v ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{l}</button>)}</div></div>
        {ta("Review / quote")}{hd("Who said it", b.heading)}</div>;
      case "checklist": return <div className="space-y-1.5">{hd("Heading", b.heading)}{(["item1", "item2", "item3", "item4", "item5", "item6"] as const).map((key, i) => <input key={key} placeholder={`Item ${i + 1}${i > 2 ? " (optional)" : ""}`} value={(b[key] ?? "") as string} onChange={(e) => patch(k, { [key]: e.target.value })} className={inputCls} />)}</div>;
      case "code": return <div className="space-y-1.5"><div><div className={lbl}>The code {codes.length > 0 && <span className="font-normal normal-case text-[#127a3e]">· {codes.length} live code{codes.length === 1 ? "" : "s"}</span>}</div><div className="flex gap-1.5">{codes.length > 0 && <select value="" onChange={(e) => { if (e.target.value) patch(k, { heading: e.target.value }); }} className={`${inputCls} max-w-[150px]`}><option value="">📋 Pick a live code…</option>{codes.map((code) => <option key={code} value={code}>{code}</option>)}</select>}<input value={b.heading ?? ""} onChange={(e) => patch(k, { heading: e.target.value })} placeholder={codes.length > 0 ? "…or type your own" : "e.g. SUMMER15"} className={`${inputCls} flex-1`} /></div></div>{hd("Label above it", b.subheading, "subheading")}{ta("Description")}</div>;
      case "stats": return <div className="space-y-2">{(b.cards || []).map((cd, i) => <div key={i} className="rounded-lg border border-[var(--line)] p-2"><div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold text-[var(--ink-3)]">Stat {i + 1}</span><button type="button" onClick={() => delCard(k, i)} className="text-[11px] font-bold text-[#c02636]">Remove</button></div><div className="space-y-1"><input placeholder="Number (e.g. 2,000+)" value={cd.title ?? ""} onChange={(e) => setCard(k, i, { title: e.target.value })} className={inputCls} /><input placeholder="Label (e.g. happy children)" value={cd.caption ?? ""} onChange={(e) => setCard(k, i, { caption: e.target.value })} className={inputCls} /></div></div>)}{(b.cards?.length ?? 0) < 4 ? <button type="button" onClick={() => addCard(k)} className="rounded-lg border border-dashed border-[var(--line)] px-3 py-1.5 text-[11.5px] font-bold text-[#1d3a8f]">＋ Add stat</button> : <div className="text-[10.5px] text-[var(--ink-3)]">Up to 4.</div>}</div>;
      case "countdown": return <div className="space-y-1.5">{hd("Heading", b.heading)}<div><div className={lbl}>Count down to (date &amp; time)</div><input type="datetime-local" step={1} value={b.date ?? ""} onChange={(e) => patch(k, { date: e.target.value })} className={inputCls} /><div className="mt-1 text-[10px] text-[var(--ink-3)]">Shows days · hrs · mins · secs left, set when the email is sent. (Email can&apos;t tick live.)</div></div>{hd("Button label (optional)", b.label, "label")}{hd("Button link", b.url, "url")}</div>;
      case "graph": return <div className="space-y-2">{hd("Chart title", b.heading)}
        <div><div className={lbl}>Chart type</div><div className="flex flex-wrap gap-1">{([["bars", "▬ Bars"], ["columns", "▮ Columns"], ["progress", "◔ Progress"], ["stacked", "▤ Stacked"], ["pie", "◕ Pie"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => patch(k, { chart: v })} className={`rounded px-2 py-1 text-[11px] font-bold ${(b.chart || "bars") === v ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{l}</button>)}</div></div>
        <div><div className={lbl}>Unit (optional)</div><div className="flex items-center gap-1.5"><input placeholder="e.g. £, %, kids" value={b.unit ?? ""} onChange={(e) => patch(k, { unit: e.target.value })} className={`${inputCls} flex-1`} />{(["£", "$", "%", ""] as const).map((u) => <button key={u || "none"} type="button" onClick={() => patch(k, { unit: u })} className={`rounded border px-2 py-1 text-[11px] font-bold ${(b.unit ?? "") === u ? "border-[#16306e] bg-[#eef4fd] text-[#1d3a8f]" : "border-[var(--line)] text-[var(--ink-2)]"}`}>{u || "none"}</button>)}</div></div>
        {(b.cards || []).map((cd, i) => <div key={i} className="rounded-lg border border-[var(--line)] p-2"><div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold text-[var(--ink-3)]">Item {i + 1}</span><button type="button" onClick={() => delCard(k, i)} className="text-[11px] font-bold text-[#c02636]">Remove</button></div><div className="grid grid-cols-2 gap-1"><input placeholder="Label" value={cd.title ?? ""} onChange={(e) => setCard(k, i, { title: e.target.value })} className={inputCls} /><input placeholder="Value (number)" value={cd.caption ?? ""} onChange={(e) => setCard(k, i, { caption: e.target.value })} className={inputCls} /></div></div>)}{(b.cards?.length ?? 0) < 6 ? <button type="button" onClick={() => addCard(k)} className="rounded-lg border border-dashed border-[var(--line)] px-3 py-1.5 text-[11.5px] font-bold text-[#1d3a8f]">＋ Add item</button> : <div className="text-[10.5px] text-[var(--ink-3)]">Up to 6 items.</div>}</div>;
      case "collage": return <div className="space-y-2">{hd("Heading (optional)", b.heading)}<div><div className={lbl}>Layout</div><div className="flex gap-1">{([["row", "▤ Even row"], ["collage", "🧩 Collage"]] as const).map(([v, l]) => { const isRow = !!b.cols && b.cols >= 2; const active = v === "row" ? isRow : !isRow; return <button key={v} type="button" onClick={() => patch(k, { cols: v === "row" ? Math.max(b.cards?.length || 3, 2) : 0 })} className={`rounded px-2 py-1 text-[11px] font-bold ${active ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{l}</button>; })}</div></div><div className="text-[10px] text-[var(--ink-3)]">Add a video link on any photo to make it a play button.</div>{(b.cards || []).map((cd, i) => <div key={i} className="rounded-lg border border-[var(--line)] p-2"><div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold text-[var(--ink-3)]">Photo {i + 1}</span><button type="button" onClick={() => delCard(k, i)} className="text-[11px] font-bold text-[#c02636]">Remove</button></div>{imgField(`${k}-c${i}`, cd, (p) => setCard(k, i, p))}</div>)}{(b.cards?.length ?? 0) < 4 ? <button type="button" onClick={() => setBlocks((bs) => bs.map((x) => (x.k === k ? { ...x, cards: [...(x.cards || []), { image: "" }] } : x)))} className="rounded-lg border border-dashed border-[var(--line)] px-3 py-1.5 text-[11.5px] font-bold text-[#1d3a8f]">＋ Add photo</button> : <div className="text-[10.5px] text-[var(--ink-3)]">Up to 4 photos.</div>}</div>;
      case "contact": return <div className="space-y-1.5">{hd("Heading (optional)", b.heading)}<div className="grid grid-cols-2 gap-2"><input autoComplete="off" data-lpignore="true" placeholder="Phone" value={b.footerPhone ?? ""} onChange={(e) => patch(k, { footerPhone: e.target.value })} className={inputCls} /><input autoComplete="off" data-lpignore="true" placeholder="Email" value={b.footerEmail ?? ""} onChange={(e) => patch(k, { footerEmail: e.target.value })} className={inputCls} /><input autoComplete="off" data-lpignore="true" placeholder="Website" value={b.footerWeb ?? ""} onChange={(e) => patch(k, { footerWeb: e.target.value })} className={inputCls} /><input autoComplete="off" data-lpignore="true" placeholder="Address" value={b.footerAddress ?? ""} onChange={(e) => patch(k, { footerAddress: e.target.value })} className={inputCls} /></div><div className="text-[10px] text-[var(--ink-3)]">Leave blank to use your saved business details.</div></div>;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50" onClick={onCancel}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--card,#fff)]" onClick={(e) => e.stopPropagation()}>
        <style>{`.aos-scroll{overflow-y:scroll}.aos-scroll::-webkit-scrollbar{width:14px;height:14px}.aos-scroll::-webkit-scrollbar-track{background:#e7ecf4;border-radius:8px}.aos-scroll::-webkit-scrollbar-thumb{background:#6f88b3;border-radius:8px;border:3px solid #e7ecf4;min-height:40px}.aos-scroll::-webkit-scrollbar-thumb:hover{background:#4f6da0}`}</style>
        <div className="flex items-center justify-between gap-3 px-5 py-3 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
          <div className="flex min-w-0 items-center gap-3">
            {design
              ? <><button type="button" onClick={() => setDesign(null)} className="flex flex-none items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[12px] font-bold hover:bg-white/25">← Templates</button><div className="min-w-0"><div className="truncate text-[15px] font-extrabold">{tpl?.name || "Design your email"}</div><div className="text-[11px] text-white/70">Move ↑↓ · duplicate ⧉ · delete 🗑 · drag any image to crop</div></div></>
              : <div><div className="text-[16px] font-extrabold">Choose a template</div><div className="text-[12px] text-white/75">30 detailed, camp-ready designs. Pick one, then make it yours block by block.</div></div>}
          </div>
          <div className="flex flex-none items-center gap-2">
            {design && <div className="flex items-center overflow-hidden rounded-lg bg-white/15"><button type="button" onClick={undo} disabled={!history.length} title="Undo" className="px-2.5 py-1.5 text-[12px] font-bold hover:bg-white/20 disabled:opacity-40">↶ Undo</button><span className="h-4 w-px bg-white/25" /><button type="button" onClick={redo} disabled={!future.length} title="Redo" className="px-2.5 py-1.5 text-[12px] font-bold hover:bg-white/20 disabled:opacity-40">Redo ↷</button></div>}
            {design && <div className="relative">
              <button type="button" onClick={() => setColourOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[12px] font-bold hover:bg-white/25"><span className="h-4 w-4 rounded-full border border-white/70" style={{ background: accentHex(design.accent) }} />Colour <span className="text-[9px]">{colourOpen ? "▲" : "▼"}</span></button>
              {colourOpen && <div className="absolute right-0 top-full z-[60] mt-2 grid w-[188px] grid-cols-5 gap-1.5 rounded-xl border border-[var(--line)] bg-white p-2.5 shadow-2xl">{TPL_ACCENTS.map((a) => <button key={a.id} type="button" onClick={() => { snapshot(); setDesign((d) => (d ? { ...d, accent: a.id } : d)); setColourOpen(false); }} title={a.name} className={`h-6 w-6 rounded-full border-2 transition ${design.accent === a.id ? "scale-110 border-[#0b1730]" : "border-white shadow hover:scale-110"}`} style={{ background: a.hex }} />)}</div>}
            </div>}
            {design && <button type="button" onClick={() => onSave(design)} className="rounded-lg bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f]">Use this design</button>}
            <button type="button" onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[16px] font-bold">×</button>
          </div>
        </div>

        {!design ? (
          <>
            <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-5 py-3">
              {CATEGORIES.map((k) => <button key={k} type="button" onClick={() => setCat(k)} className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${cat === k ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>{k}<span className="ml-1 opacity-60">{TEMPLATES.filter((t) => t.category === k).length}</span></button>)}
            </div>
            <div className="grid min-h-0 flex-1 justify-center gap-4 aos-scroll overflow-y-auto p-5" style={{ gridTemplateColumns: "repeat(auto-fill, 300px)" }}>
              {shown.map((t) => (
                <button key={t.id} type="button" onClick={() => start(t.id)} className="group w-[300px] overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-left transition hover:-translate-y-0.5 hover:border-[#2f6bd8] hover:shadow-lg">
                  <div className="h-52 w-full overflow-hidden bg-white"><div style={{ width: 640, transform: "scale(0.4625)", transformOrigin: "top left", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: renderDesignHtml({ accent: t.accentId, blocks: t.blocks() }, company, nowMs) }} /></div>
                  <div className="flex items-center justify-between border-t border-[var(--line)] px-3.5 py-2.5"><div><div className="text-[13.5px] font-extrabold text-[var(--ink)]">{t.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{t.category} · {t.blocks().length} sections</div></div><span className="rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11px] font-bold text-[#1d3a8f]">Use →</span></div>
                </button>
              ))}
            </div>
          </>
        ) : (
          // ── In-place builder: controls live ON each section of the working email ──
          <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: "radial-gradient(1200px 500px at 70% -5%, #eef3fb, #e3e8f1)" }}>
            <div className="absolute inset-0 overflow-auto" onClick={() => { setSelKey(null); setAddOpen(false); }}>
              <div className="flex min-h-full justify-center px-6 pb-28 pt-16">
                <div style={{ zoom }} className="h-max">
                  <div className="w-[640px] max-w-full overflow-hidden rounded-[18px] bg-white ring-1 ring-black/5" style={{ boxShadow: "0 40px 90px -30px rgba(20,30,60,.45)", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }} onClick={(e) => e.stopPropagation()}>
                    {groupRows(design.blocks).map((rowBlocks) => (
                      <div key={rowBlocks[0].k} className="flex items-stretch">
                        {rowBlocks.map((b) => { const i = design.blocks.indexOf(b); const fw = `${(widthOf(b) * 100).toFixed(3)}%`; return (
                          <div key={b.k} className="group relative min-w-0" style={{ flex: `0 0 ${fw}`, maxWidth: fw }} onClick={(e) => { e.stopPropagation(); setSelKey(b.k!); }}>
                            <div dangerouslySetInnerHTML={{ __html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%">${renderBlock(b, t2, company, nowMs)}</table>` }} />
                            <div className={`pointer-events-none absolute inset-0 transition ${selKey === b.k ? "ring-[3px] ring-inset ring-[#2f6bd8]" : "ring-2 ring-inset ring-transparent group-hover:ring-[#2f6bd8]/45"}`} />
                            <div className={`absolute right-2 top-2 z-20 flex items-center gap-0.5 rounded-lg bg-white px-1 py-0.5 shadow-lg ring-1 ring-black/15 transition ${selKey === b.k ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                              <span className="px-1 text-[10px] font-extrabold text-[#5b6472]">{BLOCK_LABEL[b.t]}</span>
                              {rowBlocks.length > 1 && <button type="button" title="Swap left / right" onClick={(e) => { e.stopPropagation(); move(b.k!, rowBlocks.indexOf(b) === 0 ? 1 : -1); }} className={`${ctrlBtn} text-[#1d3a8f]`}>↔</button>}
                              <button type="button" title="Move up" onClick={(e) => { e.stopPropagation(); move(b.k!, -1); }} disabled={i === 0} className={ctrlBtn}>↑</button>
                              <button type="button" title="Move down" onClick={(e) => { e.stopPropagation(); move(b.k!, 1); }} disabled={i === design.blocks.length - 1} className={ctrlBtn}>↓</button>
                              <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); dup(b.k!); }} className={ctrlBtn}>⧉</button>
                              <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); del(b.k!); }} className={`${ctrlBtn} text-[#c02636]`}>🗑</button>
                            </div>
                            <button type="button" title="Add a section here" onClick={(e) => { e.stopPropagation(); setSelKey(null); setPendingSpan(null); setAddIndex(i + 1); setAddOpen(true); }} className="absolute -bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-[#2f6bd8] px-3.5 py-1.5 text-[12px] font-extrabold leading-none text-white opacity-0 shadow-[0_8px_20px_-4px_rgba(47,107,216,.75)] ring-2 ring-white transition hover:bg-[#1d3a8f] group-hover:opacity-100"><span className="text-[15px] leading-none">＋</span> Add</button>
                          </div>
                        ); })}
                        {(() => { const used = rowBlocks.reduce((s, b) => s + widthOf(b), 0); const remain = 1 - used; if (remain < 0.02) return null; const fw = `${(remain * 100).toFixed(3)}%`; const idxAfter = design.blocks.indexOf(rowBlocks[rowBlocks.length - 1]) + 1; const rowSpan = (rowBlocks[0].span === "third" ? "third" : "half") as "half" | "third"; return (
                          <div className="min-w-0 p-1.5" style={{ flex: `0 0 ${fw}`, maxWidth: fw }} onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => { setSelKey(null); setPendingSpan(rowSpan); setAddIndex(idxAfter); setAddOpen(true); }} className="flex h-full min-h-[70px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#16a34a]/45 bg-[#16a34a]/[.05] text-[12px] font-extrabold text-[#127a3e] opacity-70 transition hover:border-[#16a34a] hover:bg-[#16a34a]/12 hover:opacity-100"><span className="text-[18px] leading-none">＋</span>Add section here</button>
                          </div>
                        ); })()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* zoom control */}
            <div className="absolute right-5 top-4 z-30 flex items-center gap-1 rounded-full border border-white/70 bg-white/90 px-1.5 py-1 shadow-lg backdrop-blur">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} className="flex h-6 w-6 items-center justify-center rounded-full text-[15px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">−</button>
              <span className="w-10 text-center text-[11.5px] font-extrabold tabular-nums text-[var(--ink-2)]">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))} className="flex h-6 w-6 items-center justify-center rounded-full text-[15px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">+</button>
            </div>

            {/* add palette — docked on the side, doesn't cover the email; inserts where you clicked */}
            {addOpen && <div className="absolute bottom-4 right-4 top-16 z-40 flex w-[300px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_-20px_rgba(20,30,60,.55)] ring-1 ring-black/10" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
                <span className="text-[13px] font-extrabold">✦ Add a section</span>
                <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10.5px] font-bold">{addIndex != null && addIndex < design.blocks.length ? `at position ${addIndex + 1}` : "at the end"}</span>
                <button type="button" onClick={() => { setAddOpen(false); setAddIndex(null); }} className="flex h-6 w-6 items-center justify-center rounded text-[16px] text-white/85 hover:bg-white/20">×</button>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 aos-scroll overflow-y-auto p-2.5">
                {ADDABLE.map((a) => <button key={a.label} type="button" onClick={() => addAt(a.make, addIndex ?? design.blocks.length)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-2.5 py-2 text-left shadow-sm transition hover:-translate-y-px hover:border-[#2f6bd8] hover:shadow-md">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-[#eef4fd] to-[#e2ecfb] text-[18px]">{a.icon}</span>
                  <span className="min-w-0"><span className="block text-[12.5px] font-extrabold text-[var(--ink)]">{a.label}</span><span className="block truncate text-[10.5px] text-[var(--ink-3)]">{a.hint}</span></span>
                </button>)}
              </div>
            </div>}

            {/* inspector for the selected section — floats over the preview */}
            {selBlock && <div className="absolute bottom-4 right-4 top-16 z-30 flex w-[384px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_-20px_rgba(20,30,60,.55)] ring-1 ring-black/10">
              <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
                <span className="text-[13px] font-extrabold">✎ Editing: {BLOCK_LABEL[selBlock.t]}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" title="Move up" onClick={() => move(selBlock.k!, -1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[14px] font-extrabold text-[#1d3a8f] shadow-sm hover:bg-[#eef4fd]">↑</button>
                  <button type="button" title="Move down" onClick={() => move(selBlock.k!, 1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[14px] font-extrabold text-[#1d3a8f] shadow-sm hover:bg-[#eef4fd]">↓</button>
                  <button type="button" title="Duplicate" onClick={() => dup(selBlock.k!)} className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[14px] font-extrabold text-[#1d3a8f] shadow-sm hover:bg-[#eef4fd]">⧉</button>
                  <button type="button" title="Delete section" onClick={() => del(selBlock.k!)} className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[14px] font-extrabold text-[#c02636] shadow-sm hover:bg-[#fdecec]">🗑</button>
                  <button type="button" onClick={() => setSelKey(null)} className="ml-1 rounded-md bg-white px-3 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f] shadow-sm hover:bg-[#eef4fd]">✓ Done</button>
                </div>
              </div>
              <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-3.5 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Width</span>
                {([["full", "Full"], ["half", "½ Half"]] as const).map(([w, l]) => <button key={w} type="button" onClick={() => patch(selBlock.k!, { span: w })} className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${(selBlock.span === "half" ? "half" : "full") === w ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-white"}`}>{l}</button>)}
                <span className="ml-auto text-[9.5px] text-[var(--ink-3)]">sits beside the next same-width section</span>
              </div>
              <div className="min-h-0 flex-1 aos-scroll overflow-y-auto p-3.5">{blockEditor(selBlock)}</div>
              <div className="border-t border-[var(--line)] p-2.5"><button type="button" onClick={() => setSelKey(null)} className="w-full rounded-lg py-2.5 text-[13px] font-extrabold text-white shadow-md transition hover:brightness-110" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>✓ Done editing</button></div>
            </div>}
          </div>
          )}
      </div>
    </div>
  );
}
