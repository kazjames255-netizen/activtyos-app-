"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_GROUPS, type NavIcon, type NavItem, type PortalKey } from "@/lib/nav/config";
import { useAuth } from "@/components/auth/AuthProvider";
import { get as apiGet } from "@/lib/api";
import { useUnreadMessages, useCouponCount } from "@/lib/use-unread";
import { useCustomerArea, useOperatorFeatures, useMoneyShow, MONEY_OUTGOING_VIEWS, MONEY_INCOMING_VIEWS, SIMPLE_ALLOWED, CORE_VIEWS, featureOff, type CustomerArea } from "@/lib/use-customer-area";
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
  if (label === "Child & details") return "Children & details";
  return label;
}

function NavLink({ item, portal, active, multiChild, unread, coupons, faded, collapsed }: { item: NavItem; portal: PortalKey; active: boolean; multiChild: boolean; unread: number; coupons: number; faded?: boolean; collapsed?: boolean }) {
  // The Messages badge is live: unread message count, not the config placeholder.
  // It grows as replies arrive and clears to nothing once the thread is opened
  // (the open marks messages read → realtime → this refetches). The Coupons badge
  // is live too — how many codes the family can use right now.
  const badge = item.view === "messages" ? (unread > 0 ? String(unread) : null)
    : item.view === "coupons" ? (coupons > 0 ? String(coupons) : null)
    : item.badge;
  // Collapsed (icon-rail) mode — used automatically in the schedule area so the
  // calendar gets the full width. Icon only, label in a hover tooltip, badge
  // shrunk to a dot.
  if (collapsed) {
    return (
      <Link
        href={`/${portal}/${item.view}`}
        title={pluralLabel(item.label, portal, multiChild)}
        className="relative mx-2 flex items-center justify-center rounded-lg py-2 no-underline hover:bg-[var(--side-hover)]"
        style={
          active
            ? { background: "rgba(255,255,255,0.16)", color: "#ffffff", boxShadow: "inset 3px 0 0 var(--side-ct-bg)" }
            : item.highlight
              ? { color: "#ffe08a", background: "rgba(250,204,21,0.14)", boxShadow: "inset 3px 0 0 #facc15" }
              : { color: "var(--side-nav)", opacity: faded ? 0.55 : 1 }
        }
      >
        <Icon icon={item.icon} />
        {badge && <span className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ background: "var(--side-ct-bg)" }} />}
      </Link>
    );
  }
  // A faded section still shows (so the parent knows it exists) but reads as
  // empty — dimmed, with a soft "no info" pill. Still tappable, so it fills in
  // the moment the provider adds something.
  if (faded) {
    const tag = NO_RECORDS_VIEWS.has(item.view) ? "No records" : "No info";
    return (
      <Link
        href={`/${portal}/${item.view}`}
        className={`${itemCls} opacity-60 transition-opacity hover:opacity-90`}
        style={{ color: "var(--side-nav)" }}
        title={`${item.label} — nothing here yet`}
      >
        <Icon icon={item.icon} />
        <span className="min-w-0 flex-1 truncate">{pluralLabel(item.label, portal, multiChild)}</span>
        <span className="ml-auto flex-none rounded-full border border-white/15 bg-white/[0.06] px-2 py-[1px] text-[8.5px] font-bold uppercase tracking-[0.06em] text-[var(--side-muted)]">{tag}</span>
      </Link>
    );
  }
  return (
    <Link
      href={`/${portal}/${item.view}`}
      className={itemCls}
      style={
        active
          ? { background: "rgba(255,255,255,0.16)", color: "#ffffff", fontWeight: 700, boxShadow: "inset 3px 0 0 var(--side-ct-bg)" }
          : item.highlight
            ? { color: "#ffe08a", background: "rgba(250,204,21,0.14)", boxShadow: "inset 3px 0 0 #facc15" }
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
function SignOutItem({ item, collapsed }: { item: NavItem; collapsed?: boolean }) {
  const router = useRouter();
  const { signOutUser } = useAuth();
  const signOut = async () => {
    await signOutUser();
    router.replace("/login");
  };
  if (collapsed) {
    return (
      <button type="button" onClick={signOut} title={item.label} className="mx-2 flex items-center justify-center rounded-lg py-2 hover:bg-[var(--side-hover)]" style={{ color: "var(--side-nav)" }}>
        <Icon icon={item.icon} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={signOut}
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
  refer: "refer", timetable: "timetable", trips: "trips", accidents: "accidents",
  medication: "medication",
};

// custdash views that FADE (with a "no info" / "no records" note) instead of
// disappearing when they're switched off / have nothing in them.
const FADE_VIEWS = new Set<string>(["moments", "newsfeed", "meals", "trips", "timetable", "accidents", "medication"]);
// Care/record sections read "No records"; the rest read "No info".
const NO_RECORDS_VIEWS = new Set<string>(["accidents", "medication", "meals"]);

function GroupItems({ items, portal, pathname, multiChild, unread, coupons, caHidden, faded, collapsed }: { items: NavItem[]; portal: PortalKey; pathname: string; multiChild: boolean; unread: number; coupons: number; caHidden: Set<string>; faded: Set<string>; collapsed?: boolean }) {
  return (
    <>
      {items.filter((item) => !item.hidden && !caHidden.has(item.view)).map((item) =>
        item.view === "auth" ? (
          <SignOutItem key={item.view} item={item} collapsed={collapsed} />
        ) : (
          <NavLink
            key={item.view}
            item={item}
            portal={portal}
            active={pathname === `/${portal}/${item.view}`}
            multiChild={multiChild}
            unread={unread}
            coupons={coupons}
            faded={faded.has(item.view)}
            collapsed={collapsed}
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

  // The full rail always shows; users can still narrow it manually with the
  // « toggle if they want more room.
  const [collapsed, setCollapsed] = useState(false);

  // The workspace is branded with the provider's own name, not "ActivityOS" —
  // that moves to the footer. For an operator that's their tenant (business)
  // name; for a parent (no tenant) it's the provider they're linked to.
  const [brand, setBrand] = useState<string | null>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  useEffect(() => {
    apiGet<Me>("/api/me")
      .then((m) => {
        if (m.tenantName) {
          setBrand(m.tenantName);
          if (m.logoUrl) setBrandLogo(m.logoUrl); // operator's own logo in their portal chrome
          return;
        }
        // Parent side: brand with their provider (Phase 1 is single-provider) —
        // their logo if uploaded, otherwise their customer-facing display name.
        apiGet<{ name: string; logoUrl?: string | null }[]>("/api/my/providers")
          .then((ps) => {
            const p = ps?.[0];
            if (p?.name) setBrand(p.name);
            if (p?.logoUrl) setBrandLogo(p.logoUrl);
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);
  const brandName = brand || "ActivityOS";

  // Live unread-message total for the Messages nav badge (see useUnreadMessages).
  const unread = useUnreadMessages(portal);
  // Live count of usable discount codes for the Coupons nav badge (custdash).
  const coupons = useCouponCount(portal);
  // Parents only see the Activity timetable tab once a provider has actually
  // published one for them — otherwise it's an empty page, so hide it. Starts
  // hidden so it never flashes before we know.
  const [hasTimetable, setHasTimetable] = useState(false);
  // Which content sections are EMPTY (no info yet) — so they fade with a
  // "no info" tag even when the provider has the feature switched on. The
  // sidebar lives in the persistent layout, so this runs once, not per nav.
  const [emptySections, setEmptySections] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (portal !== "custdash") return;
    apiGet<unknown[]>("/api/timetables/published")
      .then((w) => setHasTimetable((w?.length ?? 0) > 0))
      .catch(() => {});
    const check = (url: string, view: string) =>
      apiGet<unknown[]>(url).then((r) => ((r?.length ?? 0) > 0 ? null : view)).catch(() => null);
    Promise.all([
      check("/api/moments", "moments"),
      check("/api/posts", "newsfeed"),
      check("/api/my/meal-days", "meals"),
      check("/api/my/trips", "trips"),
      check("/api/incidents", "accidents"),
      check("/api/medications", "medication"),
    ]).then((res) => setEmptySections(new Set(res.filter(Boolean) as string[])));
  }, [portal]);
  // What to hide from this nav:
  //  • custdash — sections the provider switched off (Customer area) + Simple mode.
  //  • operator — modules the operator switched off (Setup → Features).
  const customerArea = useCustomerArea(portal);
  const features = useOperatorFeatures(portal);
  const moneyShow = useMoneyShow(portal);
  const moneyHidden = moneyShow === "outgoing" ? MONEY_INCOMING_VIEWS : moneyShow === "incoming" ? MONEY_OUTGOING_VIEWS : [];
  const caHidden = new Set<string>();
  // These "content" sections (custdash) fade with a "no info" note instead of
  // vanishing when the provider hasn't switched them on or has nothing in them —
  // so a parent still sees the section exists.
  const faded = new Set<string>();
  if (portal === "custdash") {
    if (customerArea.simpleMode) {
      for (const v of groups.flatMap((g) => g.items.map((i) => i.view)).filter((v) => v !== "auth" && !SIMPLE_ALLOWED.has(v))) caHidden.add(v);
    }
    // A feature the provider switched OFF (Customer area / Features) DISAPPEARS
    // from the customer entirely — they don't offer it.
    for (const [view, key] of Object.entries(CA_VIEW_KEY)) {
      if (customerArea[key] === false) caHidden.add(view);
    }
    // On, but nothing in it yet → still shown, faded with "no info"/"no records"
    // (an unpublished timetable counts as empty). Never fade what's hidden.
    const empty = new Set<string>([...emptySections, ...(hasTimetable ? [] : ["timetable"])]);
    for (const v of empty) if (FADE_VIEWS.has(v) && !caHidden.has(v)) faded.add(v);
  } else {
    for (const v of groups.flatMap((g) => g.items.map((i) => i.view)).filter((v) => !CORE_VIEWS.has(v) && featureOff(features, v))) caHidden.add(v);
    for (const v of moneyHidden) caHidden.add(v);
  }

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
      className={`flex h-screen flex-none flex-col overflow-x-hidden overflow-y-auto py-4 text-[13px] transition-[width] duration-200 ${collapsed ? "w-[62px]" : "w-[248px]"}`}
      style={{ background: "var(--side-bg)", color: "var(--side-ink)" }}
    >
      <div className={`flex items-center pb-4 ${collapsed ? "justify-center px-2" : "gap-2 px-4"}`}>
        {collapsed ? (
          <img
            src={brandLogo ?? undefined}
            alt={brandName}
            className={brandLogo ? "h-8 w-8 rounded-md bg-white object-contain p-0.5" : "hidden"}
          />
        ) : brandLogo ? (
          <img
            src={brandLogo}
            alt={brandName}
            className="h-10 max-w-[180px] rounded-md bg-white object-contain p-1"
          />
        ) : (
          <span
            className="block min-w-0 flex-1 truncate text-[17px] font-extrabold"
            style={{ fontFamily: "var(--ff-display)", color: "var(--side-ink)" }}
          >
            {brandName}
          </span>
        )}
        {collapsed && !brandLogo && (
          <span className="grid h-8 w-8 place-items-center rounded-md text-[15px] font-extrabold" style={{ background: "rgba(255,255,255,0.12)", color: "var(--side-ink)" }}>{brandName.slice(0, 1)}</span>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Narrow menu"
            className="grid h-6 w-6 flex-none place-items-center rounded-md text-[13px] hover:bg-[var(--side-hover)]"
            style={{ color: "var(--side-muted)" }}
          >
            «
          </button>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expand menu"
          className="mx-2 mb-2 grid place-items-center rounded-lg py-1.5 text-[14px] hover:bg-[var(--side-hover)]"
          style={{ color: "var(--side-muted)" }}
        >
          »
        </button>
      )}

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
              <GroupItems items={group.items} portal={portal} pathname={pathname} multiChild={multiChild} unread={unread} coupons={coupons} caHidden={caHidden} faded={faded} collapsed={collapsed} />
            </div>
          );
        }

        const label = group.label ?? "";
        const open = isOpen(label);
        // Collapsed rail: no group headers — every item shows as an icon, split
        // between groups by a thin divider so the strip stays scannable.
        if (collapsed) {
          return (
            <div key={label} className="mb-1 border-t border-white/10 pt-1 first:border-t-0">
              <GroupItems items={group.items} portal={portal} pathname={pathname} multiChild={multiChild} unread={unread} coupons={coupons} caHidden={caHidden} faded={faded} collapsed />
            </div>
          );
        }
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
                <GroupItems items={group.items} portal={portal} pathname={pathname} multiChild={multiChild} unread={unread} coupons={coupons} caHidden={caHidden} faded={faded} />
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
          <div className="mt-1.5 text-[10px] font-semibold leading-snug" style={{ color: "var(--side-muted)" }}>
            The unfair advantage for camps, clubs &amp; coaches
          </div>
        </div>
      </div>
    </nav>
  );
}
