"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PortalKey } from "@/lib/nav/config";

// ─────────────────────────────────────────────────────────────────────────
// The notification bell — the in-app half of lib/notify.ts on the server.
// Parents see their family's bell; operators/staff see their team's. Platform
// accounts have no bell (no tenant of their own), so the Header doesn't
// render this for them. Live via the `notifications` SSE channel; opening
// the panel marks everything read, clicking an entry deep-links to its area.
// ─────────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  category: string;
  title: string;
  body: string;
  href?: string;
  readAt: string | null;
  at: string;
}

const CATEGORY_GLYPH: Record<string, string> = {
  accident: "🩹",
  incident: "⚠️",
  medication: "💊",
  booking: "📅",
  trip: "🚌",
  calendar: "🗓️",
  message: "✉️",
  moment: "📸",
  register: "📋",
  billing: "💳",
};

// "5m ago" / "3h ago" / "2d ago" — enough precision for a bell.
function ago(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Bell({ portal }: { portal: PortalKey }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    apiGet<{ notifications: Notification[]; unread: number }>("/api/notifications")
      .then((r) => {
        setItems(r.notifications.slice(0, 30));
        setUnread(r.unread);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(["notifications"], load);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openPanel = () => {
    const next = !open;
    setOpen(next);
    // Opening acknowledges everything — the badge clears, the panel still
    // shows which entries were new (dot) until it's closed.
    if (next && unread > 0) {
      apiPost("/api/notifications/read", {}).then(() => setUnread(0)).catch(() => {});
    }
  };

  return (
    <div ref={wrapRef} className="relative flex-none">
      <button
        onClick={openPanel}
        aria-label={unread > 0 ? `Notifications (${unread} new)` : "Notifications"}
        className="relative inline-flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)]"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none"
            style={{ background: "var(--sem-crit, #ef4444)", color: "#fff" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[42px] z-50 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          <div className="border-b border-[var(--line)] px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">
            Notifications
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">
                Nothing yet — updates about {portal === "custdash" ? "your children and bookings" : "your day"} will land here.
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpen(false);
                  if (!n.href) return;
                  // Notifications are written with a `/company/…` operator path;
                  // rewrite the portal segment to wherever this recipient actually
                  // is (a freelancer's pages live under /freelancer/…), leaving
                  // parent (/custdash/…) links alone.
                  const href = portal !== "custdash"
                    ? n.href.replace(/^\/(company|franchise|freelancer|staff)\//, `/${portal}/`)
                    : n.href;
                  router.push(href);
                }}
                className="flex w-full cursor-pointer items-start gap-2.5 border-b border-[var(--line-2)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--panel)]"
              >
                <span className="mt-0.5 flex-none text-[15px]" aria-hidden>
                  {CATEGORY_GLYPH[n.category] ?? "🔔"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-bold text-[var(--ink)]">{n.title}</span>
                    <span className="flex-none text-[10.5px] text-[var(--ink-3)]">{ago(n.at)}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-[var(--ink-2)]">
                    {n.body}
                  </span>
                </span>
                {!n.readAt && (
                  <span className="mt-1.5 h-[7px] w-[7px] flex-none rounded-full" style={{ background: "var(--brand-2, #2f6bd8)" }} aria-label="new" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
