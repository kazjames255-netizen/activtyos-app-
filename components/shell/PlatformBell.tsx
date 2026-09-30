"use client";

import { DirGlyph } from "./DirGlyph";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { agoLabel } from "@/lib/i18n/format";

// The HQ notification bell — new provider signups, cancellations, support
// messages and bug reports, aggregated server-side. Clicking an entry deep-links
// straight to it (the support thread, the provider), not just the page.
interface Item { id: string; type: NType; title: string; body: string; href: string; at: string }
type NType = "signup" | "cancel" | "support" | "bug" | "lead" | "task" | "privacy";
const GLYPH: Record<NType, string> = { signup: "🎉", cancel: "🚫", support: "✉️", bug: "🐛", lead: "💬", task: "✅", privacy: "🔐" };
const LABEL: Record<NType, string> = { signup: "p8ops.pbSignup", cancel: "p8ops.pbCancel", support: "p8ops.pbSupport", bug: "p8ops.pbBug", lead: "p8ops.pbLead", task: "p8ops.pbTask", privacy: "p8ops.pbPrivacy" };

export function PlatformBell() {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [muted, setMuted] = useState<NType[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    apiGet<{ items: Item[]; unread: number; muted: NType[] }>("/api/platform/notifications")
      .then((d) => { setItems(d.items ?? []); setUnread(d.unread ?? 0); setMuted(d.muted ?? []); }).catch(() => {});
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSettings(false); } };
    document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggleOpen() {
    const next = !open; setOpen(next);
    if (next && unread > 0) { setUnread(0); apiPost("/api/platform/notifications/read", {}).catch(() => {}); }
  }
  // Clicking takes you to the thing itself, so it's dealt with: drop it from the
  // list here AND on the server, or it comes straight back on the next poll.
  function go(it: Item) {
    setOpen(false);
    setItems((cur) => cur.filter((i) => i.id !== it.id));
    setUnread((u) => Math.max(0, u - 1));
    apiPost("/api/platform/notifications/dismiss", { id: it.id }).catch(() => {});
    router.push(it.href);
  }
  function toggleMute(t: NType) {
    const next = muted.includes(t) ? muted.filter((m) => m !== t) : [...muted, t];
    setMuted(next);
    api("/api/platform/notifications/prefs", { method: "PUT", body: JSON.stringify({ muted: next }) }).then(load).catch(() => {});
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggleOpen} aria-label={t("chrome.notif")} className="relative inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span className="absolute -end-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white" style={{ background: "#ef4444" }}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-3.5 py-2.5">
            <span className="text-[13px] font-extrabold">{t("chrome.notif")}</span>
            <button type="button" onClick={() => setSettings((s) => !s)} title={t("p8ops.pbSettings")} className="text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)]">⚙</button>
          </div>

          {settings && (
            <div className="border-b border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5">
              <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8ops.pbShowMe")}</div>
              {(["signup", "cancel", "support", "bug", "privacy"] as NType[]).map((ty) => (
                <label key={ty} className="flex cursor-pointer items-center justify-between py-1 text-[12.5px]">
                  <span>{GLYPH[ty]} {t(LABEL[ty])}</span>
                  <input type="checkbox" checked={!muted.includes(ty)} onChange={() => toggleMute(ty)} className="h-4 w-4 accent-[#1d3a8f]" />
                </label>
              ))}
            </div>
          )}

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? <div className="px-4 py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8ops.pbCaughtUp")}</div>
              : items.map((it) => (
                <button key={it.id} type="button" onClick={() => go(it)} className="flex w-full items-start gap-2.5 border-b border-[var(--line)] px-3.5 py-2.5 text-start last:border-b-0 hover:bg-[#f7faff]">
                  <span className="mt-0.5 text-[15px]">{GLYPH[it.type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">{it.title}</span>
                    {it.body && <span className="block truncate text-[11.5px] text-[var(--ink-2)]">{it.body}</span>}
                    <span className="block text-[10.5px] text-[var(--ink-3)]">{agoLabel(t, it.at)}</span>
                  </span>
                  <span className="mt-1 text-[11px] text-[var(--ink-3)]"><DirGlyph>›</DirGlyph></span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
