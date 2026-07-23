"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { findNavItem, type PortalKey } from "@/lib/nav/config";
import { get as apiGet } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUnreadMessages } from "@/lib/use-unread";
import { Button } from "@/components/ui";
import { PortalSwitcher } from "./PortalSwitcher";

// Lives in the portal layout (not the per-view page) so it persists across
// view navigation; derives the current view from the URL rather than a prop
// since layouts don't receive their child page's dynamic segment.
export function Header({ portal }: { portal: PortalKey }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOutUser } = useAuth();
  const view = pathname.split("/")[2] ?? "";
  const current = findNavItem(portal, view);

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

  // The parent gets three primary actions promoted into the top bar. Operators
  // get a single Messages tab (same promotion) so replies are reachable from
  // anywhere, not just the Communication group in the sidebar.
  const tabs: { view: string; href: string; label: string; icon: ReactNode; wide: boolean; badge: number }[] =
    portal === "custdash"
      ? [
          { view: "messages", href: "/custdash/messages", label: messageLabel, icon: MAIL, wide: true, badge: unread },
          { view: "browse", href: "/custdash/browse", label: "Browse activities", icon: SEARCH, wide: false, badge: 0 },
          { view: "bookings", href: "/custdash/bookings", label: "My bookings", icon: CALENDAR, wide: false, badge: 0 },
        ]
      : findNavItem(portal, "messages")
        ? [{ view: "messages", href: `/${portal}/messages`, label: "Messages", icon: MAIL, wide: false, badge: unread }]
        : [];

  return (
    <header className="flex h-14 flex-none items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5">
      <h1 className="m-0 flex-none text-[15px] font-extrabold text-[var(--ink)]">
        {current?.label ?? view}
      </h1>

      {tabs.length > 0 && (
        <nav className="flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-1">
          {tabs.map((t) => {
            const active = view === t.view;
            return (
              <Link
                key={t.view}
                href={t.href}
                className="relative inline-flex min-w-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold no-underline transition-colors hover:bg-[var(--surface)]"
                style={active
                  ? { background: "var(--cta, #15b364)", color: "var(--cta-ink, #fff)", boxShadow: "0 1px 4px rgba(21,179,100,.35)" }
                  : { color: "var(--ink-2)" }}
              >
                <span className="flex-none [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{t.icon}</span>
                <span className={`truncate ${t.wide ? "max-w-[180px]" : ""}`}>{t.label}</span>
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
        </nav>
      )}

      <div className="flex flex-none items-center gap-3">
        {user?.email && portal !== "custdash" && <span className="text-[12px] text-[var(--ink-3)]">{user.email}</span>}
        <PortalSwitcher portal={portal} />
        <Button
          sm
          onClick={async () => {
            await signOutUser();
            router.replace("/login");
          }}
        >
          Sign out
        </Button>
      </div>
    </header>
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
