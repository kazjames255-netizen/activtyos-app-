"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { useUnreadMessages } from "@/lib/use-unread";
import { useBookingFlags } from "@/lib/use-booking-flags";
import { useCustomerArea } from "@/lib/use-customer-area";

// Phone-only bottom tab bar for the parent portal (hidden from sm up, where the
// top bar carries these). Big tap targets, current tab filled, "More" opens the
// same drawer the header hamburger does (via the aos:open-menu event).
const ic = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
const I_CAL = ic(<><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>);
const I_SEARCH = ic(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>);
const I_MAIL = ic(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>);
const I_WALLET = ic(<><path d="M3 7a2 2 0 0 1 2-2h13v4" /><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="16.5" cy="13.5" r="1" /></>);
const I_MORE = ic(<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>);

export function ParentTabBar() {
  const t = useT();
  const pathname = usePathname();
  const view = pathname.split("/")[2] ?? "";
  const area = useCustomerArea("custdash");
  const unread = useUnreadMessages("custdash");
  const flags = useBookingFlags("custdash");
  const tabs: { view: string; label: string; icon: ReactNode; badge: number; also?: string[] }[] = [
    { view: "bookings", label: t("p7shell.tabBookings"), icon: I_CAL, badge: flags.count, also: ["schedule", "payments"] },
    ...(area.browse ? [{ view: "browse", label: t("p7shell.tabBrowse"), icon: I_SEARCH, badge: 0, also: ["dash"] }] : []),
    ...(area.messaging && !area.simpleMode ? [{ view: "messages", label: t("header.messages"), icon: I_MAIL, badge: unread }] : []),
    { view: "wallet", label: t("p7shell.tabWallet"), icon: I_WALLET, badge: 0 },
  ];
  const onTab = (v: string, also?: string[]) => view === v || !!also?.includes(view);
  const cls = "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[12px] font-bold leading-tight no-underline";
  return (
    <nav
      aria-label={t("p7shell.tabsLabel")}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--line)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-12px_rgba(15,23,42,.35)] sm:hidden print:hidden"
    >
      {tabs.map((x) => {
        const on = onTab(x.view, x.also);
        return (
          <Link key={x.view} href={`/custdash/${x.view}`} aria-current={on ? "page" : undefined} className={cls} style={{ color: on ? "var(--brand, #1d3a8f)" : "var(--ink-2)" }}>
            <span className="relative flex h-8 w-14 items-center justify-center rounded-full" style={on ? { background: "var(--brand-soft,#eaf0fc)" } : undefined}>
              {x.icon}
              {x.badge > 0 && (
                <span className="absolute -top-0.5 end-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white" style={{ background: "var(--sem-crit, #ef4444)" }}>{x.badge}</span>
              )}
            </span>
            <span className={`max-w-full truncate ${on ? "font-extrabold" : ""}`}>{x.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={() => window.dispatchEvent(new Event("aos:open-menu"))} className={cls} style={{ color: "var(--ink-2)" }}>
        <span className="flex h-8 w-14 items-center justify-center">{I_MORE}</span>
        <span>{t("p7shell.tabMore")}</span>
      </button>
    </nav>
  );
}
