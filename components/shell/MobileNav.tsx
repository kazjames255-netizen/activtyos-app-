"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { useUnreadMessages } from "@/lib/use-unread";
import { useBookingFlags } from "@/lib/use-booking-flags";
import { useCustomerArea, useOperatorFeatures, CORE_VIEWS, SIMPLE_ALLOWED, featureOff } from "@/lib/use-customer-area";
import { MOBILE_TABS, type MobileTab, type PortalKey } from "@/lib/nav/config";
import { capAreaForView, capLevel, featureKeysForView, firstOff } from "@/lib/accessMap";
import { getMe, peekMe } from "@/components/auth/PortalGuard";
import { useHoScope } from "@/components/franchise/HoScope";
import { Sidebar, HO_COMBINED_KEEP } from "@/components/shell/Sidebar";

// Phone-only (<640px) navigation for EVERY portal: a bottom tab bar with the
// portal's pinned slugs (MOBILE_TABS in lib/nav/config.ts) + "More", which opens
// a full-screen sheet built from the same NAV_GROUPS the desktop sidebar uses
// (Sidebar in `sheet` mode, so the hidden / "no info" / badge rules are shared).
// Tablets keep the Header hamburger + slide-over drawer; desktop keeps the rail.
const ic = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
const ICONS: Record<MobileTab["icon"], ReactNode> = {
  cal: ic(<><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  search: ic(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
  mail: ic(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>),
  wallet: ic(<><path d="M3 7a2 2 0 0 1 2-2h13v4" /><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="16.5" cy="13.5" r="1" /></>),
  home: ic(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>),
  grid: ic(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  check: ic(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>),
  clock: ic(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  chart: ic(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
};
const I_MORE = ic(<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>);

export function MobileNav({ portal }: { portal: PortalKey }) {
  const t = useT();
  const pathname = usePathname();
  const view = pathname.split("/")[2] ?? "";
  const area = useCustomerArea(portal);
  const features = useOperatorFeatures(portal);
  const unread = useUnreadMessages(portal);
  const flags = useBookingFlags(portal);
  const hoScope = useHoScope();
  const [me, setMe] = useState(() => peekMe());
  useEffect(() => { getMe().then(setMe).catch(() => {}); }, []);

  const [open, setOpen] = useState(false);
  // Close on navigation — adjusted during render so it tracks pathname without an extra pass.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) { setSeenPath(pathname); setOpen(false); }
  // Also reachable from anywhere via the legacy event.
  useEffect(() => {
    const o = () => setOpen(true);
    window.addEventListener("aos:open-menu", o);
    return () => window.removeEventListener("aos:open-menu", o);
  }, []);
  // The sheet owns the screen while open: lock the page behind it, Escape closes.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", key); };
  }, [open]);

  const hoCombined = portal === "company" && !!me?.hasFranchises && !hoScope;
  const allowed = (v: string): boolean => {
    if (portal === "custdash") {
      if (v === "browse") return !!area.browse;
      if (v === "messages") return !!area.messaging && !area.simpleMode;
      if (v === "wallet") return area.wallet !== false && (!area.simpleMode || SIMPLE_ALLOWED.has(v));
      return !area.simpleMode || SIMPLE_ALLOWED.has(v);
    }
    if (portal === "platform") return true;
    if (hoCombined && !HO_COMBINED_KEEP.has(v)) return false;
    if (portal === "staff") {
      const a = capAreaForView(portal, v);
      return !(firstOff(features, featureKeysForView(portal, v)) || (a && capLevel(me?.caps ?? null, a) === "none"));
    }
    return CORE_VIEWS.has(v) || !featureOff(features, v);
  };
  const tabs = MOBILE_TABS[portal].filter((x) => allowed(x.view));
  const badgeFor = (v: string) => (v === "messages" ? unread : v === "bookings" ? flags.count : 0);
  const onTab = (x: MobileTab) => view === x.view || !!x.also?.includes(view);
  const cls = "relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[12px] font-bold leading-tight no-underline";

  return (
    <>
      <nav
        aria-label={t("p7shell.tabsLabel")}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--line)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-12px_rgba(15,23,42,.35)] sm:hidden print:hidden"
      >
        {tabs.map((x) => {
          const on = onTab(x);
          const badge = badgeFor(x.view);
          return (
            <Link key={x.view} href={`/${portal}/${x.view}`} aria-current={on ? "page" : undefined} data-tab={x.view} className={cls} style={{ color: on ? "var(--brand, #1d3a8f)" : "var(--ink-2)" }}>
              <span className="relative flex h-8 w-14 items-center justify-center rounded-full" style={on ? { background: "var(--brand-soft,#eaf0fc)" } : undefined}>
                {ICONS[x.icon]}
                {badge > 0 && (
                  <span className="absolute -top-0.5 end-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white" style={{ background: "var(--sem-crit, #ef4444)" }}>{badge}</span>
                )}
              </span>
              <span className={`max-w-full truncate whitespace-nowrap ${on ? "font-extrabold" : ""}`}>{t(x.label)}</span>
            </Link>
          );
        })}
        <button type="button" data-tab="more" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className={cls} style={{ color: open ? "var(--brand, #1d3a8f)" : "var(--ink-2)" }}>
          <span className="flex h-8 w-14 items-center justify-center">{I_MORE}</span>
          <span className="whitespace-nowrap">{t("p7shell.tabMore")}</span>
        </button>
      </nav>
      {open && <Sidebar portal={portal} sheet={{ onClose: () => setOpen(false) }} />}
    </>
  );
}
