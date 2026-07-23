"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_GROUPS, type NavIcon, type NavItem, type PortalKey } from "@/lib/nav/config";
import { useAuth } from "@/components/auth/AuthProvider";
import { get as apiGet } from "@/lib/api";
import { useUnreadMessages, useCouponCount } from "@/lib/use-unread";
import { useCustomerArea, type CustomerArea } from "@/lib/use-customer-area";
import type { Me } from "@/lib/roles";

function Icon({ icon }: { icon: NavIcon | null }) {
  if (!icon) return <span className="w-4 flex-none" />;
  if (icon.type === "svg") {
    return (
      <span
        className="flex w-4 flex-none items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5"
        dangerouslySetInnerHTML={{ __html: icon.markup }}
      />
    );
  }
  return <span className="w-4 flex-none text-center">{icon.value}</span>;
}

function Badge({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span
      className="ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold"
      style={{ background: "var(--side-ct-bg)", color: "var(--side-ct-ink)" }}
    >
      {value}
    </span>
  );
}

const itemCls =
  "mx-2 flex items-center gap-2 rounded-lg px-3 py-2 font-medium no-underline hover:bg-[var(--side-hover)]";

// A parent with more than one child sees plural labels ("My children",
// "My children's day") in place of the singular defaults in nav config.
function pluralLabel(label: string | null, portal: PortalKey, multiChild: boolean): string {
  if (!label) return label ?? "";
  if (portal !== "custdash" || !multiChild) return label;
  if (label === "My child") return "My children";
  if (label === "My child's day" || label === "My child’s day") return "My children’s day";
  return label;
}

function NavLink({ item, portal, active, multiChild, unread, coupons }: { item: NavItem; portal: PortalKey; active: boolean; multiChild: boolean; unread: number; coupons: number }) {
  // The Messages badge is live: unread message count, not the config placeholder.
  // It grows as replies arrive and clears to nothing once the thread is opened
  // (the open marks messages read → realtime → this refetches). The Coupons badge
  // is live too — how many codes the family can use right now.
  const badge = item.view === "messages" ? (unread > 0 ? String(unread) : null)
    : item.view === "coupons" ? (coupons > 0 ? String(coupons) : null)
    : item.badge;
  return (
    <Link
      href={`/${portal}/${item.view}`}
      className={itemCls}
      style={
        active
          ? { background: "var(--side-active)", color: "var(--side-aink)" }
          : { color: "var(--side-nav)" }
      }
    >
      <Icon icon={item.icon} />
      <span className="min-w-0 flex-1 truncate">{pluralLabel(item.label, portal, multiChild)}</span>
      <Badge value={badge} />
    </Link>
  );
}

// The nav config's `auth` items came from the prototype, where "Log out"
// opened a MOCK sign-in screen with role-switch shortcuts. With real auth
// they perform an actual Firebase sign-out instead — the legacy auth views
// are never rendered.
function SignOutItem({ item }: { item: NavItem }) {
  const router = useRouter();
  const { signOutUser } = useAuth();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOutUser();
        router.replace("/login");
      }}
      className={`${itemCls} w-[calc(100%-16px)] text-left`}
      style={{ color: "var(--side-nav)" }}
    >
      <Icon icon={item.icon} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

// custdash nav views a provider can hide via Setup → Customer area.
const CA_VIEW_KEY: Record<string, keyof CustomerArea> = {
  coupons: "coupons", wallet: "wallet", newsfeed: "newsfeed", moments: "moments",
  meals: "meals", memberships: "memberships", messages: "messaging", browse: "browse",
};

function GroupItems({ items, portal, pathname, multiChild, unread, coupons, caHidden }: { items: NavItem[]; portal: PortalKey; pathname: string; multiChild: boolean; unread: number; coupons: number; caHidden: Set<string> }) {
  return (
    <>
      {items.filter((item) => !item.hidden && !caHidden.has(item.view)).map((item) =>
        item.view === "auth" ? (
          <SignOutItem key={item.view} item={item} />
        ) : (
          <NavLink
            key={item.view}
            item={item}
            portal={portal}
            active={pathname === `/${portal}/${item.view}`}
            multiChild={multiChild}
            unread={unread}
            coupons={coupons}
          />
        ),
      )}
    </>
  );
}

export function Sidebar({ portal }: { portal: PortalKey }) {
  const pathname = usePathname();
  const groups = NAV_GROUPS[portal];
  const activeView = pathname.split("/")[2];
  const activeGroupLabel = groups.find((g) => g.items.some((i) => i.view === activeView))?.label;

  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (label: string) => openOverrides[label] ?? label === activeGroupLabel;

  // The workspace is branded with the provider's own name, not "ActivityOS" —
  // that moves to the footer. For an operator that's their tenant (business)
  // name; for a parent (no tenant) it's the provider they're linked to.
  const [brand, setBrand] = useState<string | null>(null);
  useEffect(() => {
    apiGet<Me>("/api/me")
      .then((m) => {
        if (m.tenantName) {
          setBrand(m.tenantName);
          return;
        }
        // Parent side: brand with their provider (Phase 1 is single-provider).
        apiGet<{ name: string }[]>("/api/my/providers")
          .then((ps) => ps?.[0]?.name && setBrand(ps[0].name))
          .catch(() => {});
      })
      .catch(() => {});
  }, []);
  const brandName = brand || "ActivityOS";

  // Live unread-message total for the Messages nav badge (see useUnreadMessages).
  const unread = useUnreadMessages(portal);
  // Live count of usable discount codes for the Coupons nav badge (custdash).
  const coupons = useCouponCount(portal);
  // Sections the family's provider has switched off (Setup → Customer area).
  const customerArea = useCustomerArea(portal);
  const caHidden = new Set(
    portal === "custdash"
      ? Object.entries(CA_VIEW_KEY).filter(([, key]) => customerArea[key] === false).map(([view]) => view)
      : [],
  );

  // A parent with more than one child sees plural nav labels (see pluralLabel).
  const [multiChild, setMultiChild] = useState(false);
  useEffect(() => {
    if (portal !== "custdash") return;
    apiGet<{ id: string }[]>("/api/my/children")
      .then((cs) => setMultiChild((cs?.length ?? 0) > 1))
      .catch(() => {});
  }, [portal]);

  return (
    <nav
      className="flex h-screen w-[248px] flex-none flex-col overflow-y-auto py-4 text-[13px]"
      style={{ background: "var(--side-bg)", color: "var(--side-ink)" }}
    >
      <div className="px-4 pb-4">
        <span
          className="block truncate text-[17px] font-extrabold"
          style={{ fontFamily: "var(--ff-display)", color: "var(--side-ink)" }}
        >
          {brandName}
        </span>
      </div>

      {groups.map((group) => {
        // A group whose every item is promoted elsewhere (hidden) or switched
        // off by the provider shows no header.
        if (group.items.every((i) => i.hidden || caHidden.has(i.view))) return null;
        if (group.pinned || group.footer) {
          return (
            <div
              key={group.label ?? (group.footer ? "__footer" : "__pinned")}
              className={group.footer ? "mb-1 mt-auto border-t border-white/10 pt-2" : "mb-1"}
            >
              <GroupItems items={group.items} portal={portal} pathname={pathname} multiChild={multiChild} unread={unread} coupons={coupons} caHidden={caHidden} />
            </div>
          );
        }

        const label = group.label ?? "";
        const open = isOpen(label);
        return (
          <div key={label} className="mb-0.5">
            <button
              type="button"
              onClick={() => setOpenOverrides((s) => ({ ...s, [label]: !open }))}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: "var(--side-muted)" }}
            >
              <span>{pluralLabel(group.label, portal, multiChild)}</span>
              <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
            </button>
            {open && (
              <div>
                <GroupItems items={group.items} portal={portal} pathname={pathname} multiChild={multiChild} unread={unread} coupons={coupons} caHidden={caHidden} />
              </div>
            )}
          </div>
        );
      })}

      {/* The ActivityOS wordmark lives at the foot now the provider's name owns
          the top — "powered by". mt-auto pins it to the bottom whether or not a
          portal has a footer nav group above it. */}
      <div className="mt-auto px-4 pb-2 pt-3">
        <div className="border-t border-white/10 pt-3">
          <div className="text-[8.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--side-muted)" }}>
            Powered by
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <svg viewBox="0 0 32 32" width="22" height="22" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="9" fill="url(#aosPlane)" />
              <path d="M26.5 6 L5.5 13.7 L13 16.2 L15.6 24 L18.7 17 Z" fill="#fff" />
              <path d="M13 16.2 L26.5 6 L18.7 17 Z" fill="#fff" opacity=".5" />
              <defs>
                <linearGradient id="aosPlane" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2f6bd8" />
                  <stop offset="1" stopColor="#1d3a8f" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-[15px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>
              <span style={{ color: "var(--side-ink)" }}>Activity</span>
              <span style={{ color: "#EE1F63" }}>OS</span>
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
