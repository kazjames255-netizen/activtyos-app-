"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { findNavItem, type PortalKey } from "@/lib/nav/config";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUnreadMessages } from "@/lib/use-unread";
import { useBookingFlags } from "@/lib/use-booking-flags";
import { useCustomerArea, useOperatorFeatures, featureOff } from "@/lib/use-customer-area";
import { Button } from "@/components/ui";
import { PortalSwitcher } from "./PortalSwitcher";
import { Bell } from "./Bell";
import { PlatformBell } from "./PlatformBell";
import { Sidebar } from "./Sidebar";
import { ChildLookupModal } from "@/features/registers/ChildLookupModal";

// Lives in the portal layout (not the per-view page) so it persists across
// view navigation; derives the current view from the URL rather than a prop
// since layouts don't receive their child page's dynamic segment.
export function Header({ portal }: { portal: PortalKey }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOutUser } = useAuth();
  const view = pathname.split("/")[2] ?? "";
  const current = findNavItem(portal, view);

  // Mobile nav drawer — the same Sidebar the desktop rail shows, slid over the
  // content. Navigating (pathname change) closes it.
  const [menuOpen, setMenuOpen] = useState(false);
  // Close the drawer on navigation — adjust during render (no effect) so it
  // stays in sync with pathname without a cascading re-render.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) { setMenuPath(pathname); setMenuOpen(false); }
  // "Find a child" — operator-wide safeguarding lookup (opens the child card).
  const [lookupOpen, setLookupOpen] = useState(false);
  const canLookup = portal !== "custdash" && portal !== "platform";

  // Parents message their provider from the top bar rather than a sidebar tab —
  // it's an action, not a place. Named after the provider when there's just one.
  const [providers, setProviders] = useState<{ tenantId: string; name: string }[]>([]);
  useEffect(() => {
    if (portal !== "custdash") return;
    apiGet<{ tenantId: string; name: string }[]>("/api/my/providers").then(setProviders).catch(() => {});
  }, [portal]);
  const messageLabel = providers.length === 1 ? `Message ${providers[0].name}` : "Messages";

  // Live unread total — drives the "new" bubble on the Messages tab so a reply
  // is visible from any screen and clears once the thread is opened.
  const unread = useUnreadMessages(portal);
  // Booking-area flags (approvals, change/cancel requests, failed cards; or
  // "to pay" for a parent) — badge + hover tooltip on the Bookings tab.
  const bookingFlags = useBookingFlags(portal);

  // The parent gets three primary actions promoted into the top bar. Operators
  // get a single Messages tab (same promotion) so replies are reachable from
  // anywhere, not just the Communication group in the sidebar.
  // The provider can switch Messaging / Browse off (Setup → Customer area /
  // Features). Operators lose the Messages tab when they turn Messages off.
  const customerArea = useCustomerArea(portal);
  const features = useOperatorFeatures(portal);
  const [commOpen, setCommOpen] = useState(false);
  const commRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!commOpen) return;
    const h = (e: MouseEvent) => { if (commRef.current && !commRef.current.contains(e.target as Node)) setCommOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [commOpen]);
  useEffect(() => { setCommOpen(false); }, [view]);
  const tabs: { view: string; href: string; label: string; icon: ReactNode; wide: boolean; badge: number; fancy?: boolean; accent?: string; accentLight?: string; tip?: string }[] =
    portal === "custdash"
      ? [
          ...(customerArea.messaging && !customerArea.simpleMode ? [{ view: "messages", href: "/custdash/messages", label: messageLabel, icon: MAIL, wide: true, badge: unread, accent: "#2f6bd8", accentLight: "#5b9bff", tip: unread ? `${unread} unread message${unread === 1 ? "" : "s"}` : messageLabel }] : []),
          ...(customerArea.browse ? [{ view: "browse", href: "/custdash/browse", label: "Browse activities", icon: SEARCH, wide: false, badge: 0, accent: "#7a5af8", accentLight: "#a88bff", tip: "Find & book activities" }] : []),
          { view: "bookings", href: "/custdash/bookings", label: "My bookings", icon: CALENDAR, wide: false, badge: bookingFlags.count, accent: "#0ea5a5", accentLight: "#3fd0c9", tip: bookingFlags.tip || "Your bookings" },
          // Shown only when the provider runs a membership programme (gated in
          // useCustomerArea). Given a fancy gold treatment so it stands out.
          ...(customerArea.memberships ? [{ view: "memberships", href: "/custdash/memberships", label: "Memberships", icon: STAR, wide: false, badge: 0, fancy: true }] : []),
        ]
      : [
          // Bookings promoted to the top bar (like the customer's My bookings),
          // out of the sidebar. Only where the portal has a bookings view.
          ...(findNavItem(portal, "bookings") ? [{ view: "bookings", href: `/${portal}/bookings`, label: "Bookings", icon: CALENDAR, wide: false, badge: bookingFlags.count, accent: "#0ea5a5", accentLight: "#3fd0c9", tip: bookingFlags.tip || "Bookings — nothing needs attention" }] : []),
          // Families promoted to the top bar — quick access to the family list.
          ...(findNavItem(portal, "customers") ? [{ view: "customers", href: `/${portal}/customers`, label: "Families", icon: PEOPLE, wide: false, badge: 0, accent: "#c026d3", accentLight: "#e879f9", tip: "Families — leads and customers" }] : []),
        ];

  // The green "Communication" top-bar tab: a dropdown gathering the comms
  // views (Newsfeed, Messages, Email) so they're out of the sidebar.
  const commItems: { view: string; label: string; icon: ReactNode; href: string; badge: number }[] =
    portal === "custdash" ? [] : ([
      findNavItem(portal, "newsfeed") && !featureOff(features, "newsfeed") ? { view: "newsfeed", label: "Newsfeed", icon: MEGAPHONE, href: `/${portal}/newsfeed`, badge: 0 } : null,
      findNavItem(portal, "messages") && !featureOff(features, "messages") ? { view: "messages", label: "Messages", icon: MAIL, href: `/${portal}/messages`, badge: unread } : null,
      findNavItem(portal, "email") && !featureOff(features, "email") ? { view: "email", label: "Email", icon: MAIL, href: `/${portal}/email`, badge: 0 } : null,
    ] as ({ view: string; label: string; icon: ReactNode; href: string; badge: number } | null)[]).filter((x) => x !== null) as { view: string; label: string; icon: ReactNode; href: string; badge: number }[];
  const commActive = commItems.some((c) => c.view === view);

  return (
    <header className="flex h-14 flex-none items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 sm:gap-3 sm:px-5">
      {/* Hamburger — mobile only; the desktop rail is always visible. */}
      <button
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        className="inline-flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] lg:hidden"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <Sidebar portal={portal} />
          <div className="flex-1 bg-black/50" onClick={() => setMenuOpen(false)} aria-hidden />
        </div>
      )}

      <h1 className="m-0 min-w-0 flex-none truncate text-[15px] font-extrabold text-[var(--ink)] max-sm:flex-1">
        {current?.label ?? view}
      </h1>

      {tabs.length > 0 && (
        <nav className="flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-1">
          {tabs.map((t) => {
            const active = view === t.view;
            // The Memberships tab gets a standing gold gradient (member-club feel)
            // so it draws the eye whether or not it's the active view.
            const fancyStyle = active
              ? { background: "linear-gradient(120deg,#d4a017,#f5c542)", color: "#3a2a00", boxShadow: "0 2px 8px rgba(212,160,23,.5)" }
              : { background: "linear-gradient(120deg,#f7d774,#ffe9a8)", color: "#6b4e00", boxShadow: "0 1px 5px rgba(212,160,23,.35)" };
            // Each tab carries its own colour — a soft tint at rest, a vibrant
            // gradient when active — so the bar reads as bright action buttons.
            const accent = t.accent ?? "#2f6bd8";
            const accentLight = t.accentLight ?? "#5b9bff";
            const colourStyle = active
              ? { background: `linear-gradient(120deg, ${accent}, ${accentLight})`, color: "#fff", boxShadow: `0 4px 12px -2px ${accent}80` }
              : { background: `${accent}18`, color: accent };
            return (
              <Link
                key={t.view}
                href={t.href}
                title={t.tip || t.label}
                className="relative inline-flex min-w-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-extrabold no-underline transition-all duration-150 hover:-translate-y-px hover:brightness-105"
                style={t.fancy ? fancyStyle : colourStyle}
              >
                <span className="flex-none [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{t.icon}</span>
                {/* Icon-only on phones; the label returns from sm up. */}
                <span className={`hidden truncate sm:inline ${t.wide ? "max-w-[180px]" : ""}`}>{t.label}</span>
                {t.badge > 0 && (
                  <span
                    className="ml-0.5 flex h-[16px] min-w-[16px] flex-none items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none"
                    style={{ background: "var(--sem-crit, #ef4444)", color: "#fff" }}
                  >
                    {t.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {commItems.length > 0 && (
            <div className="relative" ref={commRef}>
              <button
                type="button"
                onClick={() => setCommOpen((o) => !o)}
                title="Communication — newsfeed, messages and email"
                className="relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-extrabold transition-all duration-150 hover:-translate-y-px hover:brightness-105"
                style={commActive || commOpen ? { background: "linear-gradient(120deg,#0f9d58,#3ddc84)", color: "#fff", boxShadow: "0 4px 12px -2px #0f9d5880" } : { background: "#0f9d5818", color: "#0b7a43" }}
              >
                <span className="flex-none [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{CHAT}</span>
                <span className="hidden truncate sm:inline">Communication</span>
                <span className="flex-none text-[9px] leading-none" aria-hidden>▼</span>
                {unread > 0 && (
                  <span className="ml-0.5 flex h-[16px] min-w-[16px] flex-none items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none" style={{ background: "var(--sem-crit, #ef4444)", color: "#fff" }}>{unread}</span>
                )}
              </button>
              {commOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_18px_44px_-16px_rgba(15,23,42,.4)]">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Communication</div>
                  {commItems.map((it) => {
                    const on = it.view === view;
                    return (
                      <Link key={it.view} href={it.href} onClick={() => setCommOpen(false)} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-bold no-underline transition-colors" style={on ? { background: "#eafaf0", color: "#0b7a43" } : { color: "var(--ink)" }}>
                        <span className="flex-none text-[#0f9d58] [&_svg]:h-[17px] [&_svg]:w-[17px]" aria-hidden>{it.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{it.label}</span>
                        {it.badge > 0 && <span className="flex h-[16px] min-w-[16px] flex-none items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white" style={{ background: "#ef4444" }}>{it.badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      )}

      {canLookup && (
        <button
          type="button"
          onClick={() => setLookupOpen(true)}
          title="Find a child — key info card"
          className="inline-flex flex-none items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[12.5px] font-extrabold transition-all duration-150 hover:-translate-y-px hover:brightness-105"
          style={{ background: "#4f46e51a", color: "#4338ca" }}
        >
          <span aria-hidden>🔎</span>
          <span className="hidden sm:inline">Find a child</span>
        </button>
      )}

      <div className="flex flex-none items-center gap-2 sm:gap-3">
        {user?.email && portal !== "custdash" && <span className="hidden text-[12px] text-[var(--ink-3)] xl:inline">{user.email}</span>}
        {/* Platform accounts have no tenant, so no bell of their own (the API
            would return an empty list anyway). HQ triages bug reports rather
            than filing them, so no bug button either. */}
        {portal !== "platform" && <BugReport />}
        {portal !== "platform" && <Bell portal={portal} />}
        {portal === "platform" && <PlatformBell />}
        <PortalSwitcher portal={portal} />
        {/* On phones the drawer's "Log out" item covers this. */}
        <Button
          sm
          className="max-sm:hidden !border-transparent !bg-[#e11d481a] !text-[#be123c] hover:!bg-[#e11d4826]"
          onClick={async () => {
            await signOutUser();
            router.replace("/login");
          }}
        >
          Sign out
        </Button>
      </div>
      {lookupOpen && <ChildLookupModal onClose={() => setLookupOpen(false)} />}
    </header>
  );
}

// "Report a bug" — a tiny intake next to the bell that opens a bug thread in
// the HQ support inbox (POST /api/support/report). The page and device are
// captured automatically from the route and user agent; the reporter only
// says what happened and how bad it felt.
function BugReport() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setSeverity("medium");
    setSteps("");
    setBusy(false);
    setSent(false);
    setError(null);
  };

  const submit = () => {
    if (!steps.trim() || busy || sent) return;
    setBusy(true);
    setError(null);
    apiPost("/api/support/report", {
      page: pathname,
      steps: steps.trim(),
      severity,
      device: navigator.userAgent,
    })
      .then(() => {
        setSent(true);
        setTimeout(close, 1500);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Couldn't send the report");
        setBusy(false);
      });
  };

  const inputCls =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand-2,#2f6bd8)]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        title="Report a bug"
        className="relative inline-flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)]"
      >
        <span className="text-[15px] leading-none" aria-hidden>🐞</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <span className="text-[13.5px] font-extrabold text-[var(--ink)]">🐞 Report a bug</span>
              <button onClick={close} aria-label="Close" className="cursor-pointer text-[var(--ink-3)] hover:text-[var(--ink)]">✕</button>
            </div>
            {sent ? (
              <p className="px-4 py-8 text-center text-[13px] font-bold text-[var(--ink)]">Thanks — we&apos;re on it.</p>
            ) : (
              <div className="flex flex-col gap-3 px-4 py-4">
                <label className="block">
                  <span className="mb-1 block text-[11.5px] font-bold text-[var(--ink-3)]">How bad is it?</span>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value as "low" | "medium" | "high")} className={inputCls}>
                    <option value="low">Low — a niggle</option>
                    <option value="medium">Medium — it&apos;s in the way</option>
                    <option value="high">High — I&apos;m stuck</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11.5px] font-bold text-[var(--ink-3)]">What happened?</span>
                  <textarea
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    rows={4}
                    autoFocus
                    placeholder="What were you doing, and what went wrong?"
                    className={`${inputCls} resize-none`}
                  />
                </label>
                <p className="m-0 text-[11px] text-[var(--ink-3)]">The page you&apos;re on and your device details are included automatically.</p>
                {error && <p className="m-0 text-[12px] font-bold" style={{ color: "var(--sem-crit, #ef4444)" }}>{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button sm onClick={close}>Cancel</Button>
                  <Button sm variant="primary" disabled={!steps.trim() || busy} onClick={submit}>
                    {busy ? "Sending…" : "Send report"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Line icons for the top tab bar — kept minimal and monochrome so they inherit
// the tab's text colour (white when active).
const MAIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
);
const SEARCH = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);
const CALENDAR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
const STAR = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" /></svg>
);
const PEOPLE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" /><path d="M16.5 6.5a3 3 0 0 1 0 5.6M17.6 20c0-2.3-1.2-4.2-3-5.1" /></svg>
);
const CHAT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.5-4.4A8.3 8.3 0 0 1 3.5 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" /></svg>
);
const MEGAPHONE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h2l3.5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M14 8.5a4 4 0 0 1 0 7M18 6a7 7 0 0 1 0 12" /></svg>
);
