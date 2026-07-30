"use client";
/* eslint-disable @next/next/no-img-element -- campaign images are arbitrary operator-uploaded URLs; next/image doesn't fit inline-styled email HTML. */

// ─────────────────────────────────────────────────────────────────────────
// Campaign email BUILDER — a block-based email designer (like the newsfeed):
// 30 rich starting templates you can then edit block-by-block — duplicate,
// reorder, add or remove sections; drop small / medium / full-width images
// exactly where you want; build product-card rows with prices, pricing tiers,
// colour bands, social rows and more. Everything renders to email-safe,
// table-based, absolute-free HTML, and every text colour is derived from its
// background via a per-accent theme so recolouring never hides text.
// ─────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import { post as apiPost } from "@/lib/api";
import { downscaleImage, type Company } from "@/features/newsfeed/newsletter";

export type BlockType = "header" | "hero" | "band" | "heading" | "text" | "image" | "cards" | "tiers" | "split" | "button" | "social" | "divider" | "footer";
export interface Card { image?: string; title?: string; caption?: string; price?: string; label?: string; url?: string }
export interface Social { net: string; url?: string }
export interface Block { k?: string; t: BlockType; heading?: string; subheading?: string; body?: string; image?: string; size?: "s" | "m" | "full"; align?: "left" | "center" | "right"; label?: string; url?: string; caption?: string; cols?: number; cards?: Card[]; flip?: boolean; socials?: Social[] }
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
export interface Theme { a: string; aDark: string; aDeep: string; aSoft: string; onA: string; onAMut: string; onDeep: string; onDeepMut: string; ink: string; mut: string; line: string; cardAlt: string }
const theme = (hex: string): Theme => { const a = hex, aDark = shade(hex, -42), aDeep = shade(hex, -72); return { a, aDark, aDeep, aSoft: hex + "1c", onA: readable(a), onAMut: mutedOn(a), onDeep: readable(aDeep), onDeepMut: mutedOn(aDeep), ink: "#14213a", mut: "#5b6472", line: "#e6ebf2", cardAlt: "#f4f6f8" }; };
export const accentHex = (id: string) => TPL_ACCENTS.find((a) => a.id === id)?.hex ?? id;

// ── html helpers ──────────────────────────────────────────────────────────
const para = (s: string | undefined, style: string) => (s ?? "").split(/\n{2,}/).filter(Boolean).map((p) => `<p style="${style}">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const imgTag = (url: string | undefined, style: string, ph: string) => (url ? `<img src="${esc(url)}" alt="" style="display:block;${style}">` : `<div style="${style.replace(/object-fit:[^;]+;?/, "")};background:${ph}"></div>`);
const btn = (bg: string, fg: string, label?: string, url?: string) => `<a href="${esc(url || "#")}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:800;font-size:14px;padding:12px 28px;border-radius:26px">${esc(label || "Learn more")}</a>`;
const btnSm = (bg: string, fg: string, label?: string, url?: string) => `<a href="${esc(url || "#")}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:800;font-size:11px;padding:7px 14px;border-radius:14px">${esc(label || "More")}</a>`;
const row = (inner: string, style = "") => `<tr><td style="${style}">${inner}</td></tr>`;
const wrapRows = (rows: string) => `<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:600px">${rows}</table></div>`;

const SOC: Record<string, { bg: string; ch: string }> = { facebook: { bg: "#3b5998", ch: "f" }, twitter: { bg: "#1da1f2", ch: "t" }, instagram: { bg: "#c13584", ch: "◎" }, linkedin: { bg: "#0a66c2", ch: "in" }, youtube: { bg: "#ff0000", ch: "▶" }, website: { bg: "#4a5568", ch: "🔗" } };
const DEFAULT_SOCIALS: Social[] = [{ net: "facebook" }, { net: "instagram" }, { net: "twitter" }, { net: "website" }];

// ── one block → email-safe html (theme-aware) ──────────────────────────────
function renderBlock(b: Block, t: Theme, c?: Partial<Company>): string {
  const brand = b.heading || c?.name || "Your business";
  switch (b.t) {
    case "header":
      return row(`<table role="presentation" width="100%" style="border-collapse:collapse"><tr><td style="font-size:17px;font-weight:900;letter-spacing:.5px;color:${t.onA}">${esc(brand)}</td>${b.subheading ? `<td align="right" style="font-size:12px;font-weight:600;color:${t.onAMut}">${esc(b.subheading)}</td>` : ""}</tr></table>`, `background:${t.a};padding:16px 22px`);
    case "hero":
      return (b.image ? row(imgTag(b.image, "width:100%;height:230px;object-fit:cover", t.aDark), "padding:0;font-size:0;line-height:0") : "") +
        row(`<h1 style="margin:0;font-size:32px;line-height:1.05;font-weight:900;color:${t.onA}">${esc(b.heading)}</h1>${b.subheading ? `<div style="margin-top:8px;font-size:16px;font-weight:600;color:${t.onAMut}">${esc(b.subheading)}</div>` : ""}${para(b.body, `margin:12px 0 ${b.label ? "16px" : "0"};font-size:14px;line-height:1.6;color:${t.onAMut}`)}${b.label ? btn(t.onA, readable(t.onA), b.label, b.url) : ""}`, `background:${t.a};background-image:linear-gradient(160deg,${t.a},${t.aDark});padding:26px 26px 30px;text-align:center`);
    case "band":
      return row(`<h2 style="margin:0;font-size:17px;font-weight:800;color:${t.onA};text-align:center">${esc(b.heading)}</h2>${b.body ? `<div style="margin-top:5px;font-size:13px;color:${t.onAMut};text-align:center">${esc(b.body)}</div>` : ""}${b.label ? `<div style="text-align:center;margin-top:12px">${btn(t.onA, readable(t.onA), b.label, b.url)}</div>` : ""}`, `background:${t.a};padding:16px 24px`);
    case "heading":
      return row(`<h2 style="margin:0;font-size:23px;font-weight:800;color:${t.ink};text-align:center">${esc(b.heading)}</h2>${b.subheading ? `<div style="text-align:center;margin-top:4px;font-size:13.5px;color:${t.mut}">${esc(b.subheading)}</div>` : ""}<div style="height:3px;width:54px;background:${t.a};margin:12px auto 0"></div>`, "padding:24px 26px 6px");
    case "text":
      return row(para(b.body, `margin:0 0 10px;font-size:14px;line-height:1.7;color:${t.mut}`), "padding:8px 30px");
    case "image": {
      const w = b.size === "s" ? "200px" : b.size === "m" ? "340px" : "100%";
      const al = b.align || "center";
      return row(`<div style="text-align:${al}">${imgTag(b.image, `width:${w};max-width:100%;height:auto;border-radius:12px;margin:0 ${al === "center" ? "auto" : "0"}`, t.aDark)}${b.caption ? `<div style="margin-top:6px;font-size:12px;color:${t.mut}">${esc(b.caption)}</div>` : ""}</div>`, "padding:12px 26px");
    }
    case "cards": {
      const per = b.cols || 3, cs = b.cards || []; let inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%"><tr>`;
      cs.forEach((cd, i) => { if (i > 0 && i % per === 0) inner += "</tr><tr>"; inner += `<td valign="top" width="${Math.floor(100 / per)}%" style="padding:8px;text-align:center"><div>${cd.image ? imgTag(cd.image, "width:100%;height:110px;object-fit:cover;border-radius:10px", t.aDark) : ""}<div style="margin-top:8px;font-size:13px;font-weight:800;color:${t.ink}">${esc(cd.title)}</div>${cd.caption ? `<div style="font-size:11.5px;line-height:1.4;color:${t.mut};margin-top:2px">${esc(cd.caption)}</div>` : ""}${cd.price ? `<div style="margin-top:4px;font-size:13px;font-weight:800;color:${t.a}">${esc(cd.price)}</div>` : ""}${cd.label ? `<div style="margin-top:7px">${btnSm(t.a, t.onA, cd.label, cd.url)}</div>` : ""}</div></td>`; });
      const rem = cs.length % per; if (rem) for (let j = 0; j < per - rem; j++) inner += `<td width="${Math.floor(100 / per)}%"></td>`;
      return row(inner + "</tr></table>", "padding:12px 14px");
    }
    case "tiers": {
      const cs = b.cards || []; let inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%"><tr>`;
      cs.forEach((cd) => { inner += `<td valign="top" width="${Math.floor(100 / Math.max(cs.length, 1))}%" style="padding:6px"><div style="background:${t.cardAlt};border-radius:14px;padding:16px 12px;text-align:center"><div style="font-size:13px;font-weight:800;color:${t.ink}">${esc(cd.title)}</div><div style="margin:8px 0;font-size:26px;font-weight:900;color:${t.a}">${esc(cd.price)}</div><div style="font-size:11.5px;line-height:1.5;color:${t.mut};min-height:34px">${esc(cd.caption)}</div>${cd.label ? `<div style="margin-top:10px">${btnSm(t.a, t.onA, cd.label, cd.url)}</div>` : ""}</div></td>`; });
      return row(inner + "</tr></table>", "padding:12px 14px");
    }
    case "split": {
      const im = imgTag(b.image, "width:100%;height:150px;object-fit:cover;border-radius:10px", t.aDark);
      const txt = `<h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:${t.ink}">${esc(b.heading)}</h3>${para(b.body, `margin:0 0 ${b.label ? "12px" : "0"};font-size:13px;line-height:1.6;color:${t.mut}`)}${b.label ? btnSm(t.a, t.onA, b.label, b.url) : ""}`;
      const left = b.flip ? txt : im, right = b.flip ? im : txt;
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%"><tr><td valign="middle" width="46%" style="padding-right:9px">${left}</td><td valign="middle" width="54%" style="padding-left:9px">${right}</td></tr></table>`, "padding:14px 26px");
    }
    case "button":
      return row(btn(t.a, t.onA, b.label, b.url), `text-align:${b.align || "center"};padding:14px 26px`);
    case "social": {
      const list = (b.socials && b.socials.length ? b.socials : DEFAULT_SOCIALS);
      const icons = list.map((s) => { const m = SOC[s.net] || SOC.website; return `<td style="padding:0 5px"><a href="${esc(s.url || "#")}" style="text-decoration:none"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:50%;background:${m.bg};color:#fff;font-weight:800;font-size:14px">${m.ch}</span></a></td>`; }).join("");
      return row(`<table role="presentation" align="center" style="margin:0 auto;border-collapse:collapse"><tr>${icons}</tr></table>`, "text-align:center;padding:16px 26px");
    }
    case "divider":
      return row(`<div style="height:1px;background:${t.line}"></div>`, "padding:4px 26px");
    case "footer":
      return row(`<div style="font-size:14px;font-weight:800;color:${t.ink}">${esc(brand)}</div>${b.body ? `<div style="margin-top:3px;font-size:12px;color:${t.mut}">${esc(b.body)}</div>` : ""}<div style="margin-top:8px;font-size:11px;color:${t.mut}">You're receiving this because you've booked with us. <span style="color:${t.a}">Unsubscribe</span> any time.</div>`, `background:${t.cardAlt};text-align:center;padding:20px 26px`);
    default:
      return "";
  }
}

// ── seeds ──────────────────────────────────────────────────────────────────
const B = (t: BlockType, p: Partial<Block> = {}): Block => ({ t, ...p });
const C = (title: string, caption = "", price = "", label = ""): Card => ({ title, caption, price, label });
const foot = (): Block => B("footer", { body: "Address · Town · Postcode" });
const soc = (): Block => B("social", { socials: DEFAULT_SOCIALS });

export interface CampaignTemplate { id: string; name: string; category: string; accentId: string; blocks: () => Block[] }
export const TEMPLATES: CampaignTemplate[] = [
  { id: "refer", name: "Refer a friend", category: "Promote", accentId: "mint", blocks: () => [B("header", { subheading: "Rewards" }), B("hero", { image: "", heading: "Refer a friend, reap the rewards", subheading: "You both win.", body: "When a friend books their first session, you'll each get £10 off.", label: "Get your link" }), B("band", { heading: "Sharing pays off for you and your network" }), B("cards", { cols: 3, cards: [C("1. Share", "Send your unique link"), C("2. They book", "A friend joins us"), C("3. You save", "£10 off — each!")] }), soc(), foot()] },
  { id: "camp-open", name: "Camp now open", category: "Promote", accentId: "blue", blocks: () => [B("hero", { image: "", heading: "Summer camp is OPEN", subheading: "Six weeks of adventure, sport & friends", label: "Book your weeks" }), B("band", { heading: "We've got huge savings on early bookings", label: "Save now" }), B("cards", { cols: 3, cards: [C("Week 1", "21–25 Jul", "£110"), C("Week 2", "28 Jul–1 Aug", "£110"), C("Week 3", "4–8 Aug", "£110")] }), soc(), foot()] },
  { id: "rentals", name: "Product / price list", category: "Promote", accentId: "green", blocks: () => [B("header", { subheading: "Book online & save 10%" }), B("heading", { heading: "What's on offer" }), B("cards", { cols: 3, cards: [C("Multi-Sports Day", "All ages", "From £30"), C("Holiday Club", "Mon–Thu", "From £22/day"), C("Weekend Workshop", "Sat mornings", "From £18")] }), B("divider"), B("split", { image: "", heading: "Our policies", body: "Late collections are charged per the posted rate. Places are held on payment. Full T&Cs on our site." }), B("button", { label: "Book online now" }), soc(), foot()] },
  { id: "apparel", name: "Categories showcase", category: "Promote", accentId: "coral", blocks: () => [B("hero", { image: "", heading: "Everything for the season", subheading: "Quality kit for every activity" }), B("band", { heading: "20% off your first order this month" }), B("cards", { cols: 3, cards: [C("Multi-Sports", "Ages 4–12"), C("Forest School", "Outdoor fun"), C("Creative Studio", "Arts & crafts")] }), B("split", { image: "", flip: true, heading: "You'll find it all here", body: "From sports and forest school to arts and cooking — one provider, endless days out.", label: "Shop now" }), B("button", { label: "Browse everything" }), soc(), foot()] },
  { id: "tiers", name: "Pricing tiers", category: "Promote", accentId: "red", blocks: () => [B("hero", { image: "", heading: "The will to keep going", subheading: "Intensive holiday training programmes" }), B("tiers", { cards: [C("1 Week", "Mornings only", "£100", "Book"), C("2 Weeks", "Full days", "£189", "Book"), C("3 Weeks", "Full + care", "£289", "Book")] }), B("button", { label: "See all programmes" }), foot()] },
  { id: "early-bird", name: "Early-bird offer", category: "Promote", accentId: "blue", blocks: () => [B("header", { subheading: "Early-bird" }), B("heading", { heading: "Book by Sunday & save 20%" }), B("cards", { cols: 3, cards: [C("Multi-Sports", "Every weekday", "£88"), C("Forest Club", "Rain or shine", "£96"), C("Creative", "Messy & fun", "£84")] }), B("band", { heading: "Early-bird ends Sunday midnight", label: "Book & save" }), foot()] },
  { id: "flash", name: "Flash sale", category: "Promote", accentId: "red", blocks: () => [B("band", { heading: "48-HOUR FLASH SALE — 20% OFF" }), B("hero", { image: "", heading: "This weekend only", subheading: "One code, one weekend, big savings", label: "Shop the sale" }), B("cards", { cols: 2, cards: [C("Holiday Club week", "", "was £110 now £88"), C("Weekend workshop", "", "was £18 now £14")] }), soc(), foot()] },
  { id: "waitlist", name: "Waitlist opened", category: "Promote", accentId: "amber", blocks: () => [B("header", {}), B("hero", { image: "", heading: "A place just opened up", subheading: "You're near the top of the list", body: "A space is free for the dates you wanted. First to confirm keeps it.", label: "Claim the place" }), foot()] },

  { id: "season", name: "Season / membership", category: "Announce", accentId: "navy", blocks: () => [B("hero", { image: "", heading: "SEASON PASS", subheading: "Join the family for 2026" }), B("text", { body: "It's been an incredible year and we're just getting started. Join now for guaranteed places and member-only perks all season." }), B("cards", { cols: 1, cards: [C("Dedicated account manager", "One friendly contact for everything"), C("Priority booking", "First pick of every holiday club")] }), B("button", { label: "Become a member" }), foot()] },
  { id: "fixture", name: "Fixture / match day", category: "Announce", accentId: "green", blocks: () => [B("header", { subheading: "Match day" }), B("hero", { image: "", heading: "Friendly Match Day", subheading: "Come and cheer them on!" }), B("cards", { cols: 3, cards: [C("Date", "Sat 14 Jun"), C("Kick-off", "10:00 AM"), C("Venue", "Main field")] }), B("button", { label: "Add to calendar" }), foot()] },
  { id: "tournament", name: "Tournament / event", category: "Announce", accentId: "amber", blocks: () => [B("hero", { image: "", heading: "SUMMER TOURNAMENT", subheading: "Seniors & juniors welcome" }), B("heading", { heading: "Save the date" }), B("cards", { cols: 3, cards: [C("Date", "Mon 19 Jun"), C("Time", "7:00 PM"), C("Where", "Sports ground")] }), B("button", { label: "Register a team" }), foot()] },
  { id: "open-day", name: "Open day invite", category: "Announce", accentId: "navy", blocks: () => [B("header", {}), B("hero", { image: "", heading: "You're invited", subheading: "Come and see what we're about" }), B("cards", { cols: 2, cards: [C("Open Morning", "Sat 12 Jul · 10–12"), C("Taster Session", "Wed 16 Jul · 4–5pm")] }), B("button", { label: "Let us know you're coming" }), soc(), foot()] },
  { id: "new-venue", name: "New venue", category: "Announce", accentId: "coral", blocks: () => [B("hero", { image: "", heading: "We're opening a new venue!", subheading: "More places, closer to home" }), B("text", { body: "From September you'll find us at a brand-new site with even more space to play and learn." }), B("image", { image: "", size: "m", caption: "Our new home" }), B("button", { label: "See the venue" }), foot()] },
  { id: "showcase", name: "Activity showcase", category: "Announce", accentId: "blue", blocks: () => [B("header", {}), B("heading", { heading: "Something for everyone" }), B("cards", { cols: 3, cards: [C("Multi-Sports", "Every weekday"), C("Forest School", "Rain or shine"), C("Arts & Crafts", "Messy & fun"), C("Drama Club", "Big stage"), C("Coding Lab", "Build & play"), C("Cooking", "Taste the win")] }), B("button", { label: "Explore all" }), foot()] },
  { id: "anniversary", name: "Anniversary", category: "Announce", accentId: "purple", blocks: () => [B("hero", { image: "", heading: "Ten years of play", subheading: "2016 – 2026" }), B("text", { body: "A decade of muddy knees, proud faces and brilliant memories — thank you for being part of the story." }), B("image", { image: "", size: "full" }), B("button", { label: "See how we've grown" }), foot()] },
  { id: "fundraiser", name: "Fundraiser", category: "Announce", accentId: "red", blocks: () => [B("hero", { image: "", heading: "JOIN THE FUND", subheading: "Help us give free places to families who need them" }), B("heading", { heading: "Open now until the end of term" }), B("band", { heading: "Every booking helps a family in need", label: "Get involved" }), foot()] },

  { id: "welcome", name: "Welcome pack", category: "Welcome", accentId: "teal", blocks: () => [B("header", {}), B("hero", { image: "", heading: "Welcome aboard!", subheading: "We're so pleased to have you" }), B("text", { body: "Here's everything you need for a brilliant first day." }), B("cards", { cols: 2, cards: [C("What to bring", "Lunch, water, sun cream & a coat"), C("Drop-off & pick-up", "Doors 8:45am · collect by 3:30pm")] }), foot()] },
  { id: "what-to-bring", name: "What to bring", category: "Welcome", accentId: "teal", blocks: () => [B("header", {}), B("heading", { heading: "See you soon!" }), B("text", { body: "A few reminders so the day runs smoothly for everyone." }), B("cards", { cols: 2, cards: [C("Pack", "Labelled lunch, snacks, water"), C("Please note", "No nuts on site")] }), foot()] },
  { id: "meet-team", name: "Meet the team", category: "Welcome", accentId: "purple", blocks: () => [B("header", {}), B("heading", { heading: "Meet the team" }), B("cards", { cols: 3, cards: [C("Sam", "Camp lead"), C("Priya", "Forest school"), C("Jordan", "Sports coach")] }), B("text", { body: "Every one of our team is DBS-checked and first-aid trained — and genuinely brilliant with children." }), foot()] },

  { id: "weekly", name: "Weekly round-up", category: "Update", accentId: "purple", blocks: () => [B("header", { subheading: "This week" }), B("heading", { heading: "This week's round-up" }), B("split", { image: "", heading: "Camp highlights", body: "The children smashed our mini-Olympics — medals, mud and a whole lot of laughing." }), B("split", { image: "", flip: true, heading: "Coming up", body: "Early-bird places for the next holiday club open Friday." }), B("band", { heading: "Book early — sessions fill fast", label: "See what's on" }), soc(), foot()] },
  { id: "photo-story", name: "Photo story", category: "Update", accentId: "amber", blocks: () => [B("header", {}), B("image", { image: "", size: "full" }), B("heading", { heading: "What a week!" }), B("text", { body: "From mini-Olympics to den-building, the children packed a lot in. More photos are on your parent app." }), B("image", { image: "", size: "full" }), foot()] },
  { id: "term-dates", name: "Term dates", category: "Update", accentId: "teal", blocks: () => [B("header", {}), B("heading", { heading: "Term dates" }), B("cards", { cols: 3, cards: [C("Autumn", "2 Sep – 20 Dec"), C("Half-term", "27–31 Oct"), C("Spring", "6 Jan – 4 Apr"), C("Half-term", "16–20 Feb"), C("Summer", "22 Apr – 22 Jul"), C("INSET", "TBC")] }), foot()] },
  { id: "menu", name: "Menu update", category: "Update", accentId: "green", blocks: () => [B("header", {}), B("heading", { heading: "New on the menu" }), B("cards", { cols: 3, cards: [C("Mon", "Pasta & garlic bread"), C("Wed", "Chicken wraps"), C("Fri", "Fish & chips")] }), B("text", { body: "All allergen-friendly and child-approved. Let us know of any dietary needs." }), foot()] },
  { id: "tips", name: "Parent tips", category: "Update", accentId: "teal", blocks: () => [B("header", {}), B("heading", { heading: "5 ways to make mornings easier" }), B("text", { body: "1. Lay it out the night before.\n\n2. Name everything.\n\n3. Give little jobs.\n\n4. Keep it calm.\n\n5. A five-minute head start beats a ten-minute rush." }), foot()] },
  { id: "review", name: "Review request", category: "Update", accentId: "blue", blocks: () => [B("header", {}), B("heading", { heading: "How did we do?" }), B("text", { body: "We'd love a quick word on how your child found their sessions. It takes a minute and helps other families choose us." }), B("button", { label: "Leave a review" }), foot()] },
  { id: "survey", name: "Survey invite", category: "Update", accentId: "purple", blocks: () => [B("header", {}), B("band", { heading: "Two minutes of your time?" }), B("text", { body: "We're planning next term and your view shapes it — venues, times, activities, the lot." }), B("button", { label: "Take the survey" }), foot()] },

  { id: "seasonal", name: "Seasonal greeting", category: "Seasonal", accentId: "red", blocks: () => [B("hero", { image: "", heading: "Season's greetings", subheading: "from all of us" }), B("text", { body: "Wishing your family a wonderful holiday and a happy, healthy new year." }), foot()] },
  { id: "end-term", name: "End-of-term thanks", category: "Seasonal", accentId: "amber", blocks: () => [B("header", {}), B("heading", { heading: "Thank you for a brilliant term" }), B("text", { body: "Rest up, have fun, and we'll see you next time. It's been a joy." }), B("image", { image: "", size: "full" }), foot()] },
  { id: "star", name: "Star of the week", category: "Seasonal", accentId: "pink", blocks: () => [B("band", { heading: "⭐ Star of the week ⭐" }), B("heading", { heading: "Kindness, effort and the biggest smile" }), B("text", { body: "We love celebrating the little wins. Ask your child about their moment!" }), foot()] },

  { id: "payment", name: "Payment reminder", category: "Admin", accentId: "navy", blocks: () => [B("header", {}), B("heading", { heading: "A friendly payment reminder" }), B("text", { body: "Your balance for the upcoming sessions is due soon. You can pay securely in your parent account — just a nudge so your place stays held." }), foot()] },
  { id: "closure", name: "Closure notice", category: "Admin", accentId: "red", blocks: () => [B("header", { subheading: "Important" }), B("heading", { heading: "Session update" }), B("text", { body: "Due to circumstances beyond our control, the session on this date won't run. Affected families will be contacted directly about options." }), foot()] },
  { id: "price-update", name: "Price update", category: "Admin", accentId: "navy", blocks: () => [B("header", {}), B("heading", { heading: "A note on our prices" }), B("text", { body: "From the new term our prices change slightly so we can keep ratios small and our team brilliant. Full details are in your account — thank you." }), foot()] },
];

export const CATEGORIES = ["All", "Promote", "Announce", "Welcome", "Update", "Seasonal", "Admin"];
export const templateOf = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
export function renderDesignHtml(d: CampaignDesign, c?: Partial<Company>): string { return wrapRows((d.blocks || []).map((b) => renderBlock(b, theme(accentHex(d.accent) || d.accent), c)).join("")); }
export function renderDesignText(d: CampaignDesign): string { const out: string[] = []; for (const b of d.blocks || []) { [b.heading, b.subheading, b.body, b.label].forEach((s) => { if (s && s.trim()) out.push(s.trim()); }); (b.cards || []).forEach((cd) => { [cd.title, cd.caption, cd.price].forEach((s) => { if (s && s.trim()) out.push(s.trim()); }); }); } return out.join("\n\n"); }
export const newDesign = (templateId: string, c?: Partial<Company>): CampaignDesign => { const t = templateOf(templateId); const blocks = t.blocks().map((b) => (b.t === "header" || b.t === "footer") && !b.heading ? { ...b, heading: c?.name || "" } : b); return { templateId, accent: t.accentId, blocks }; };

// ── block palette for the "add section" menu ───────────────────────────────
const ADDABLE: { t: BlockType; label: string; make: () => Block }[] = [
  { t: "heading", label: "Heading", make: () => B("heading", { heading: "Section heading" }) },
  { t: "text", label: "Text", make: () => B("text", { body: "Write your message here." }) },
  { t: "image", label: "Image", make: () => B("image", { image: "", size: "full", align: "center" }) },
  { t: "hero", label: "Hero (image + text)", make: () => B("hero", { image: "", heading: "Big headline", subheading: "A supporting line", label: "" }) },
  { t: "cards", label: "Cards (3 columns)", make: () => B("cards", { cols: 3, cards: [C("Title", "Caption", "£0"), C("Title", "Caption", "£0"), C("Title", "Caption", "£0")] }) },
  { t: "tiers", label: "Pricing tiers", make: () => B("tiers", { cards: [C("Basic", "What's included", "£0", "Choose"), C("Plus", "What's included", "£0", "Choose"), C("Pro", "What's included", "£0", "Choose")] }) },
  { t: "split", label: "Image + text", make: () => B("split", { image: "", heading: "Title", body: "A short paragraph.", label: "" }) },
  { t: "band", label: "Colour band", make: () => B("band", { heading: "A highlighted message", label: "" }) },
  { t: "button", label: "Button", make: () => B("button", { label: "Book now", url: "" }) },
  { t: "social", label: "Social icons", make: () => soc() },
  { t: "divider", label: "Divider", make: () => B("divider") },
  { t: "footer", label: "Footer", make: () => foot() },
];
const BLOCK_LABEL: Record<BlockType, string> = { header: "Header", hero: "Hero", band: "Colour band", heading: "Heading", text: "Text", image: "Image", cards: "Cards", tiers: "Pricing tiers", split: "Image + text", button: "Button", social: "Social icons", divider: "Divider", footer: "Footer" };

// ── designer ───────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]";
const lbl = "mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]";

export function CampaignDesigner({ initial, company, onCancel, onSave }: { initial?: CampaignDesign | null; company?: Partial<Company>; onCancel: () => void; onSave: (d: CampaignDesign) => void }) {
  const uid = useRef(1000);
  const nk = () => `b${uid.current++}`;
  const [design, setDesign] = useState<CampaignDesign | null>(() => (initial ? { ...initial, blocks: initial.blocks.map((b, i) => ({ ...b, k: `i${i}` })) } : null));
  const [cat, setCat] = useState("All");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const tpl = design ? templateOf(design.templateId || "") : null;
  const shown = cat === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat);
  const start = (id: string) => setDesign({ ...newDesign(id, company), blocks: newDesign(id, company).blocks.map((b) => ({ ...b, k: nk() })) });
  const setBlocks = (fn: (bs: Block[]) => Block[]) => setDesign((d) => (d ? { ...d, blocks: fn(d.blocks) } : d));
  const patch = (k: string, p: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.k === k ? { ...b, ...p } : b)));
  const move = (k: string, dir: -1 | 1) => setBlocks((bs) => { const i = bs.findIndex((b) => b.k === k); const j = i + dir; if (i < 0 || j < 0 || j >= bs.length) return bs; const n = [...bs]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const dup = (k: string) => setBlocks((bs) => { const i = bs.findIndex((b) => b.k === k); if (i < 0) return bs; return [...bs.slice(0, i + 1), { ...bs[i], k: nk(), cards: bs[i].cards ? bs[i].cards!.map((c) => ({ ...c })) : undefined }, ...bs.slice(i + 1)]; });
  const del = (k: string) => setBlocks((bs) => bs.filter((b) => b.k !== k));
  const add = (make: () => Block) => { setBlocks((bs) => [...bs, { ...make(), k: nk() }]); setAddOpen(false); };
  const setCard = (bk: string, ci: number, p: Partial<Card>) => setBlocks((bs) => bs.map((b) => (b.k === bk ? { ...b, cards: (b.cards || []).map((c, i) => (i === ci ? { ...c, ...p } : c)) } : b)));
  const addCard = (bk: string) => setBlocks((bs) => bs.map((b) => (b.k === bk ? { ...b, cards: [...(b.cards || []), C("New", "", "")] } : b)));
  const delCard = (bk: string, ci: number) => setBlocks((bs) => bs.map((b) => (b.k === bk ? { ...b, cards: (b.cards || []).filter((_, i) => i !== ci) } : b)));
  const upload = async (key: string, apply: (url: string) => void, file: File) => { setBusyKey(key); try { const small = await downscaleImage(file); const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl: small }); apply(url); } catch { /* ignore */ } setBusyKey(null); };

  const imgField = (id: string, url: string | undefined, onSet: (u: string) => void) => (
    url ? <div className="flex items-center gap-2"><img src={url} alt="" className="h-10 w-16 flex-none rounded border border-[var(--line)] object-cover" /><button type="button" onClick={() => onSet("")} className="text-[11px] font-bold text-[#c02636]">Remove</button></div>
      : <div className="flex flex-wrap items-center gap-1.5"><label className="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{busyKey === id ? "…" : "⬆ Image"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(id, onSet, f); e.target.value = ""; }} /></label><input placeholder="or URL" value={url ?? ""} onChange={(e) => onSet(e.target.value)} className={`${inputCls} min-w-[110px] flex-1`} /></div>
  );

  const blockEditor = (b: Block) => {
    const k = b.k!;
    const hd = (label: string, val?: string, key: keyof Block = "heading") => <div><div className={lbl}>{label}</div><input value={(val ?? "") as string} onChange={(e) => patch(k, { [key]: e.target.value })} className={inputCls} /></div>;
    const ta = (label: string, key: keyof Block = "body") => <div><div className={lbl}>{label}</div><textarea rows={2} value={(b[key] ?? "") as string} onChange={(e) => patch(k, { [key]: e.target.value })} className={inputCls} /></div>;
    switch (b.t) {
      case "header": return <div className="space-y-1.5">{hd("Business name", b.heading)}{hd("Tagline (optional)", b.subheading, "subheading")}</div>;
      case "hero": return <div className="space-y-1.5"><div><div className={lbl}>Image</div>{imgField(`${k}-img`, b.image, (u) => patch(k, { image: u }))}</div>{hd("Heading", b.heading)}{hd("Sub-heading", b.subheading, "subheading")}{ta("Body")}{hd("Button label (blank = none)", b.label, "label")}{hd("Button link", b.url, "url")}</div>;
      case "band": return <div className="space-y-1.5">{hd("Heading", b.heading)}{ta("Text (optional)")}{hd("Button label (blank = none)", b.label, "label")}{hd("Button link", b.url, "url")}</div>;
      case "heading": return <div className="space-y-1.5">{hd("Heading", b.heading)}{hd("Sub-heading (optional)", b.subheading, "subheading")}</div>;
      case "text": return ta("Text");
      case "image": return <div className="space-y-1.5">{imgField(`${k}-img`, b.image, (u) => patch(k, { image: u }))}<div className="flex items-center gap-3"><div><div className={lbl}>Size</div><div className="flex gap-1">{(["s", "m", "full"] as const).map((s) => <button key={s} type="button" onClick={() => patch(k, { size: s })} className={`rounded px-2 py-1 text-[11px] font-bold ${b.size === s ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{s === "s" ? "Small" : s === "m" ? "Medium" : "Full"}</button>)}</div></div><div><div className={lbl}>Align</div><div className="flex gap-1">{(["left", "center", "right"] as const).map((al) => <button key={al} type="button" onClick={() => patch(k, { align: al })} className={`rounded px-2 py-1 text-[11px] font-bold ${(b.align || "center") === al ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{al[0].toUpperCase()}</button>)}</div></div></div>{hd("Caption (optional)", b.caption, "caption")}</div>;
      case "split": return <div className="space-y-1.5">{imgField(`${k}-img`, b.image, (u) => patch(k, { image: u }))}<label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={!!b.flip} onChange={(e) => patch(k, { flip: e.target.checked })} /> Image on the right</label>{hd("Heading", b.heading)}{ta("Body")}{hd("Button label (blank = none)", b.label, "label")}{hd("Button link", b.url, "url")}</div>;
      case "button": return <div className="space-y-1.5">{hd("Label", b.label, "label")}{hd("Link", b.url, "url")}</div>;
      case "footer": return <div className="space-y-1.5">{hd("Business name", b.heading)}{hd("Address line", b.body, "body")}</div>;
      case "divider": return <div className="text-[11.5px] text-[var(--ink-3)]">A thin divider line.</div>;
      case "social": return <div className="space-y-1.5">{(b.socials || DEFAULT_SOCIALS).map((s, i) => <div key={i} className="flex items-center gap-1.5"><span className="w-16 text-[11.5px] font-bold capitalize text-[var(--ink-2)]">{s.net}</span><input placeholder="Link" value={s.url ?? ""} onChange={(e) => patch(k, { socials: (b.socials || DEFAULT_SOCIALS).map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} className={inputCls} /></div>)}</div>;
      case "cards":
      case "tiers": return <div className="space-y-2">{b.t === "cards" && <div className="flex items-center gap-2"><span className={lbl}>Columns</span>{[2, 3].map((n) => <button key={n} type="button" onClick={() => patch(k, { cols: n })} className={`rounded px-2 py-0.5 text-[11px] font-bold ${(b.cols || 3) === n ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)]"}`}>{n}</button>)}</div>}
        {(b.cards || []).map((cd, i) => <div key={i} className="rounded-lg border border-[var(--line)] p-2"><div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold text-[var(--ink-3)]">Item {i + 1}</span><button type="button" onClick={() => delCard(k, i)} className="text-[11px] font-bold text-[#c02636]">Remove</button></div><div className="space-y-1"><input placeholder="Title" value={cd.title ?? ""} onChange={(e) => setCard(k, i, { title: e.target.value })} className={inputCls} /><input placeholder={b.t === "tiers" ? "Price (e.g. £100)" : "Caption"} value={(b.t === "tiers" ? cd.price : cd.caption) ?? ""} onChange={(e) => setCard(k, i, b.t === "tiers" ? { price: e.target.value } : { caption: e.target.value })} className={inputCls} />{b.t === "cards" && <input placeholder="Price (optional)" value={cd.price ?? ""} onChange={(e) => setCard(k, i, { price: e.target.value })} className={inputCls} />}{b.t === "tiers" && <input placeholder="What's included" value={cd.caption ?? ""} onChange={(e) => setCard(k, i, { caption: e.target.value })} className={inputCls} />}{b.t === "cards" && imgField(`${k}-c${i}`, cd.image, (u) => setCard(k, i, { image: u }))}<div className="grid grid-cols-2 gap-1"><input placeholder="Button (optional)" value={cd.label ?? ""} onChange={(e) => setCard(k, i, { label: e.target.value })} className={inputCls} /><input placeholder="Link" value={cd.url ?? ""} onChange={(e) => setCard(k, i, { url: e.target.value })} className={inputCls} /></div></div></div>)}
        <button type="button" onClick={() => addCard(k)} className="rounded-lg border border-dashed border-[var(--line)] px-3 py-1.5 text-[11.5px] font-bold text-[#1d3a8f]">＋ Add item</button></div>;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-[3vh]" onClick={onCancel}>
      <div className="flex w-full max-w-[1060px] flex-col overflow-hidden rounded-3xl bg-[var(--card,#fff)] shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "94vh" }}>
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
          <div><div className="text-[16px] font-extrabold">{design ? "Design your email" : "Choose a template"}</div><div className="text-[12px] text-white/75">{design ? "Edit, duplicate or add sections — drop images anywhere, at any size." : "30 provider-ready designs. Pick one, then make it yours block by block."}</div></div>
          <div className="flex items-center gap-2">{design && <button type="button" onClick={() => onSave(design)} className="rounded-lg bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f]">Use this design</button>}<button type="button" onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[16px] font-bold">×</button></div>
        </div>

        {!design ? (
          <>
            <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-5 py-3">
              {CATEGORIES.map((k) => <button key={k} type="button" onClick={() => setCat(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${cat === k ? "bg-[#16306e] text-white" : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>{k}{k !== "All" && <span className="ml-1 opacity-60">{TEMPLATES.filter((t) => t.category === k).length}</span>}</button>)}
            </div>
            <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((t) => (
                <button key={t.id} type="button" onClick={() => start(t.id)} className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-left transition hover:-translate-y-0.5 hover:border-[#2f6bd8] hover:shadow-lg">
                  <div className="h-60 overflow-hidden bg-[#f3f6fb]"><div style={{ width: 600, transform: "scale(0.46)", transformOrigin: "top left", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: renderDesignHtml({ accent: t.accentId, blocks: t.blocks() }, company) }} /></div>
                  <div className="flex items-center justify-between border-t border-[var(--line)] px-3.5 py-2.5"><div><div className="text-[13.5px] font-extrabold text-[var(--ink)]">{t.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{t.category}</div></div><span className="rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11px] font-bold text-[#1d3a8f]">Use →</span></div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_430px]">
            <div className="min-h-0 space-y-2.5 overflow-y-auto border-r border-[var(--line)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setDesign(null)} className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">← Templates</button>
                <span className="text-[13px] font-extrabold text-[var(--ink)]">{tpl?.name}</span>
                <div className="ml-auto flex flex-wrap gap-1">{TPL_ACCENTS.map((a) => <button key={a.id} type="button" onClick={() => setDesign((d) => (d ? { ...d, accent: a.id } : d))} title={a.name} className={`h-6 w-6 rounded-full border-2 ${design.accent === a.id ? "border-[#0b1730]" : "border-white shadow"}`} style={{ background: a.hex }} />)}</div>
              </div>
              {design.blocks.map((b, i) => (
                <div key={b.k} className="rounded-xl border border-[var(--line)] bg-white">
                  <div className="flex items-center gap-1.5 rounded-t-xl bg-[var(--panel)] px-2.5 py-1.5">
                    <span className="text-[11.5px] font-extrabold text-[var(--ink-2)]">{BLOCK_LABEL[b.t]}</span>
                    <div className="ml-auto flex items-center gap-0.5 text-[13px]">
                      <button type="button" title="Move up" onClick={() => move(b.k!, -1)} disabled={i === 0} className="rounded px-1.5 py-0.5 text-[var(--ink-3)] hover:bg-white disabled:opacity-30">↑</button>
                      <button type="button" title="Move down" onClick={() => move(b.k!, 1)} disabled={i === design.blocks.length - 1} className="rounded px-1.5 py-0.5 text-[var(--ink-3)] hover:bg-white disabled:opacity-30">↓</button>
                      <button type="button" title="Duplicate" onClick={() => dup(b.k!)} className="rounded px-1.5 py-0.5 text-[var(--ink-3)] hover:bg-white">⧉</button>
                      <button type="button" title="Delete" onClick={() => del(b.k!)} className="rounded px-1.5 py-0.5 text-[#c02636] hover:bg-white">🗑</button>
                    </div>
                  </div>
                  <div className="p-2.5">{blockEditor(b)}</div>
                </div>
              ))}
              <div className="relative">
                <button type="button" onClick={() => setAddOpen((v) => !v)} className="w-full rounded-xl border-2 border-dashed border-[var(--line)] px-3 py-2.5 text-[12.5px] font-extrabold text-[#1d3a8f] hover:border-[#2f6bd8] hover:bg-[#f4f8ff]">＋ Add a section</button>
                {addOpen && <div className="absolute bottom-full left-0 z-10 mb-1 grid w-full grid-cols-2 gap-1 rounded-xl border border-[var(--line)] bg-white p-2 shadow-xl">{ADDABLE.map((a) => <button key={a.t + a.label} type="button" onClick={() => add(a.make)} className="rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--panel)]">{a.label}</button>)}</div>}
              </div>
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
