"use client";

// Web links shown on things — a task's Google Drive/Docs/Sheets links, the
// links in a calendar event's notes. One link opens straight in a new tab;
// several drop down a list. Clicks never reach the card underneath.
import { useState } from "react";

export interface WebLink { url: string; title?: string }

/** What a pasted address is, so the list reads "Google Sheet", not a URL soup. */
export function urlKind(raw: string): { icon: string; label: string } {
  let u: URL; try { u = new URL(raw); } catch { return { icon: "🔗", label: "Link" }; }
  const h = u.hostname.replace(/^www\./, ""), p = u.pathname.toLowerCase();
  if (h === "docs.google.com") {
    if (p.startsWith("/spreadsheets")) return { icon: "📊", label: "Google Sheet" };
    if (p.startsWith("/presentation")) return { icon: "📽️", label: "Google Slides" };
    if (p.startsWith("/forms")) return { icon: "📝", label: "Google Form" };
    return { icon: "📄", label: "Google Doc" };
  }
  if (h === "drive.google.com") return { icon: "📁", label: p.includes("/folders/") ? "Google Drive folder" : "Google Drive file" };
  if (h.endsWith("dropbox.com")) return { icon: "📦", label: "Dropbox" };
  if (h === "1drv.ms" || h.endsWith("onedrive.live.com") || h.endsWith("sharepoint.com")) return { icon: "☁️", label: "OneDrive / SharePoint" };
  if (h.endsWith("claude.ai") || h.endsWith("claude.site")) return { icon: "✨", label: "Claude page" };
  if (/\.pdf$/.test(p)) return { icon: "📕", label: `PDF · ${h}` };
  if (/\.html?$/.test(p)) return { icon: "🌐", label: `Web page · ${h}` };
  return { icon: "🔗", label: h };
}
/** A pasted address, made safe to open — or why it can't be. */
export function normaliseUrl(raw: string): { url?: string; error?: string } {
  const v = raw.trim();
  if (!v) return {};
  if (/^file:|^\/|^~\/|^[a-z]:\\/i.test(v)) return { error: "That's a file on your computer — a web page can't open those. Put it on Google Drive (or publish it) and paste that link instead." };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return { error: "Only web links (https://…) can be added." };
    if (!u.hostname.includes(".")) return { error: "That doesn't look like a web address." };
    return { url: u.toString() };
  } catch { return { error: "That doesn't look like a web address." }; }
}
/** Every web address in a piece of text (an event's notes). */
export function linksIn(text?: string): WebLink[] {
  if (!text) return [];
  const seen = new Set<string>();
  return [...text.matchAll(/https?:\/\/[^\s<>"]+/gi)].map((m) => m[0].replace(/[),.;]+$/, "")).filter((u) => !seen.has(u) && !!seen.add(u)).map((url) => ({ url }));
}

export function LinkBadge({ links, compact, onDark }: { links: WebLink[]; compact?: boolean; onDark?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!links.length) return null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  // A solid button, not a tint: on a coloured calendar chip a see-through pill
  // disappeared into the chip. White on colour; brand blue on white.
  const cls = `inline-flex flex-none items-center gap-1 rounded-full font-extrabold shadow-[0_1px_3px_rgba(15,23,42,.35)] ring-1 transition hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(15,23,42,.35)] ${compact ? "px-1.5 py-[1px] text-[9.5px]" : "px-2 py-0.5 text-[10.5px]"}`;
  const tone = onDark ? { background: "#fff", color: "#1d3a8f", ["--tw-ring-color" as string]: "rgba(29,58,143,.25)" } : { background: "#1d3a8f", color: "#fff", ["--tw-ring-color" as string]: "rgba(29,58,143,.35)" };
  const labelOf = (u: WebLink) => u.title || urlKind(u.url).label;
  if (links.length === 1) {
    const u = links[0];
    return <a href={u.url} target="_blank" rel="noopener noreferrer" onClick={stop} onMouseDown={stop} draggable={false} title={`Open ${labelOf(u)}`} className={cls} style={tone}><span className="text-[11px] leading-none">{urlKind(u.url).icon}</span>{compact ? "" : "Open"}<span aria-hidden>↗</span></a>;
  }
  return (
    <span className="relative flex-none" onClick={stop} onMouseDown={stop}>
      <button type="button" onClick={() => setOpen((v) => !v)} title={links.map(labelOf).join("\n")} aria-expanded={open} className={cls} style={tone}><span className="text-[11px] leading-none">🔗</span>{links.length}{compact ? "" : " links"}<span className="text-[8px]">{open ? "▲" : "▼"}</span></button>
      {open && (
        <>
          <span className="fixed inset-0 z-[150]" onClick={() => setOpen(false)} />
          <span className="absolute right-0 top-full z-[151] mt-1 block w-[240px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 text-left shadow-[0_18px_44px_-16px_rgba(15,23,42,.45)]">
            {links.map((u, i) => { const k = urlKind(u.url); return (
              <a key={i} href={u.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#f2f6ff]">
                <span className="text-[14px]">{k.icon}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold text-[#1d3a8f]">{labelOf(u)}</span><span className="block truncate text-[10px] font-normal text-[var(--ink-3)]">{u.title ? k.label : u.url}</span></span>
                <span className="text-[10px] text-[#1d3a8f]">↗</span>
              </a>
            ); })}
          </span>
        </>
      )}
    </span>
  );
}
