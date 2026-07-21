"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { findNavItem, type PortalKey } from "@/lib/nav/config";
import { get as apiGet } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
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

  // The parent's three primary actions, promoted from the sidebar into a fancy
  // top tab bar. Message is named after the provider when there's just one.
  const custTabs = [
    { view: "messages", href: "/custdash/messages", label: messageLabel, icon: MAIL, wide: true },
    { view: "browse", href: "/custdash/browse", label: "Browse activities", icon: SEARCH, wide: false },
    { view: "bookings", href: "/custdash/bookings", label: "My bookings", icon: CALENDAR, wide: false },
  ];

  return (
    <header className="flex h-14 flex-none items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5">
      <h1 className="m-0 flex-none text-[15px] font-extrabold text-[var(--ink)]">
        {current?.label ?? view}
      </h1>

      {portal === "custdash" && (
        <nav className="flex min-w-0 items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] p-1 shadow-[inset_0_1px_2px_rgba(20,30,60,.04)]">
          {custTabs.map((t) => {
            const active = view === t.view;
            return (
              <Link
                key={t.view}
                href={t.href}
                className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold no-underline transition-all"
                style={
                  active
                    ? { background: "linear-gradient(135deg,var(--brand-2,#2f6bd8),var(--brand,#1d3a8f))", color: "#fff", boxShadow: "0 3px 10px -4px rgba(29,58,143,.5)" }
                    : { color: "var(--ink-2)" }
                }
              >
                <span className="flex-none [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{t.icon}</span>
                <span className={`truncate ${t.wide ? "max-w-[180px]" : ""}`}>{t.label}</span>
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
