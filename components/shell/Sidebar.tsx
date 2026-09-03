"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_GROUPS, type NavIcon, type NavItem, type PortalKey } from "@/lib/nav/config";
import { useAuth } from "@/components/auth/AuthProvider";
import { getMe, peekMe } from "@/components/auth/PortalGuard";
import { useHoScope } from "@/components/franchise/HoScope";

// In the head-office "Whole business (all)" view, only aggregate/oversight views
// make sense. Two kinds survive: things the HO MANAGES centrally, and read-only
// OVERSIGHT views (safeguarding, attendance, staff compliance) that the HO must
// monitor network-wide with a per-franchise breakdown. The pure per-site
// operational rest (listing editing, schedule, meals menu, per-site money, etc.)
// is hidden until the HO drills into ONE franchise via the scope switcher.
const HO_COMBINED_KEEP = new Set<string>([
  "dashboard", "dash", "splitfees", "territories", "ho-framework",
  "tasks", "email", "messages", "activityos", "newsfeed",
  "reviews", "ai", "subscription", "getpaid",
  // Head office's money is ONE simplified Finance page (P&L + royalty income +
  // breakdown by franchise) — see HoFinanceApp. The per-site ledgers stay
  // reachable by direct link from it, not as separate sidebar items.
  "finance",
  // Head office invites + manages its OWN central team (Director/Ops/Marketing/Admin)
  "staff",
  "setup", "account", "support", "auth", "franchise-invites", "franchise-overview", "franchise-features",
  // Read-only oversight across all franchises (safeguarding + attendance)
  "incidents", "accidents", "medication", "registers",
]);
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
              ? { color: "#ffffff", background: "rgba(255,255,255,0.06)", boxShadow: "inset 3px 0 0 rgba(255,255,255,0.6)" }
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
            ? { color: "#ffffff", background: "rgba(255,255,255,0.06)", boxShadow: "inset 3px 0 0 rgba(255,255,255,0.6)" }
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
  // Franchise identity — head-office-granted business name + territory, badged under the brand.
  const [fr, setFr] = useState<{ name: string | null; area: string | null } | null>(null);
  // Head office only sees franchisor tools once it has ≥1 franchise. Start hidden to avoid a flash.
  const [hasFranchises, setHasFranchises] = useState(() => peekMe()?.role === "company" && !!peekMe()?.hasFranchises);
  // The HO scope switcher — null = "Whole business (all)" (slim oversight nav).
  const hoScope = useHoScope();
  useEffect(() => {
    getMe()
      .then((m) => {
        if (m.role === "company") setHasFranchises(!!m.hasFranchises);
        if (m.role === "franchise") setFr({ name: m.franchiseName ?? null, area: m.franchiseArea ?? null });
        if (m.tenantName) {
          // A named franchise brands with its own business name; else the tenant (head office) name.
          setBrand((m.role === "franchise" && m.franchiseName) || m.tenantName);
          return;
        }
        // Parent side: brand with their provider (Phase 1 is single-provider) —
        // their customer-facing display name.
        apiGet<{ name: string }[]>("/api/my/providers")
          .then((ps) => {
            const p = ps?.[0];
            if (p?.name) setBrand(p.name);
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
    // Franchisor-only tools stay hidden until a head office actually has a franchise.
    if (portal === "company" && !hasFranchises) { caHidden.add("splitfees"); caHidden.add("territories"); }
    // Head office "Whole business (all)" view = slim oversight nav. Operational
    // views only appear once the HO drills into ONE franchise (or its own
    // locations) via the scope switcher. Only applies to a company WITH franchises.
    if (portal === "company" && hasFranchises && !hoScope) {
      for (const v of groups.flatMap((g) => g.items.map((i) => i.view))) {
        if (!HO_COMBINED_KEEP.has(v)) caHidden.add(v);
      }
    }
  }

  const hoCombined = portal === "company" && hasFranchises && !hoScope;

  // Head office gets a bespoke, concise sidebar — clear group names, no lonely
  // single-item groups, in a franchisor-sensible order. Built from the company
  // nav items (reusing their icons/hrefs/badges) but regrouped and relabelled.
  // Some of these views are `hidden:true` in the base company nav (comms +
  // safeguarding oversight); we surface them here.
  const HO_LABEL: Record<string, string> = { incidents: "Incidents", accidents: "Accidents", medication: "Medication", staff: "Head office staff" };
  const HO_SECTIONS: { label: string | null; views: string[] }[] = [
    { label: null, views: ["dashboard"] },
    { label: "Overview", views: ["tasks", "ai"] },
    { label: "Franchises", views: ["franchise-overview", "franchise-features", "franchise-invites", "territories"] },
    { label: "Money", views: ["finance", "splitfees", "subscription", "getpaid"] },
    { label: "Communication", views: ["newsfeed", "messages", "email", "activityos"] },
    { label: "People & reviews", views: ["staff", "reviews"] },
    { label: "Safeguarding oversight", views: ["incidents", "accidents", "medication", "registers"] },
    { label: "Settings", views: ["setup"] },
  ];

  let displayGroups = groups;
  if (hoCombined) {
    const byView = new Map(groups.flatMap((g) => g.items).map((i) => [i.view, i]));
    // Curated views are always shown (never suppressed by feature/money gating).
    for (const s of HO_SECTIONS) for (const v of s.views) caHidden.delete(v);
    const built = HO_SECTIONS.map((s) => ({
      label: s.label,
      pinned: s.views.includes("dashboard"),
      footer: false,
      items: s.views
        .map((v) => byView.get(v))
        .filter((it): it is NavItem => !!it)
        .map((it) => ({ ...it, hidden: false, ...(HO_LABEL[it.view] ? { label: HO_LABEL[it.view] } : {}) })),
    })).filter((g) => g.items.length > 0);
    const footer = groups.find((g) => g.footer);
    displayGroups = footer ? [...built, footer] : built;
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
      style={{
        color: "var(--side-ink)",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.6px), var(--side-bg)",
        backgroundSize: "18px 18px, cover, cover, cover, cover",
        backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat",
      }}
    >
      <div className={`flex items-center pb-4 ${collapsed ? "justify-center px-2" : "gap-2 px-4"}`}>
        {/* Text name only — no logo in the portal chrome. */}
        {collapsed ? (
          <span className="grid h-8 w-8 place-items-center rounded-md text-[15px] font-extrabold" style={{ background: "rgba(255,255,255,0.12)", color: "var(--side-ink)" }}>{brandName.slice(0, 1)}</span>
        ) : (
          <span className="block min-w-0 flex-1">
            <span
              className={`block break-words font-extrabold leading-[1.08] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden ${
                brandName.length > 30 ? "text-[12px]" : brandName.length > 24 ? "text-[13px]" : brandName.length > 18 ? "text-[14.5px]" : "text-[17px]"
              }`}
              title={brandName}
              style={{ fontFamily: "var(--ff-display)", color: "var(--side-ink)" }}
            >
              {brandName}
            </span>
            {fr && (fr.area || fr.name) && (
              <span
                className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-[2px] text-[10px] font-extrabold uppercase tracking-wide"
                style={{ background: "rgba(245,184,31,0.18)", color: "#f5b81f" }}
                title={`${fr.area ? `${fr.area} ` : ""}franchise`}
              >
                🌐 {fr.area ? `${fr.area} franchise` : "Franchise"}
              </span>
            )}
          </span>
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

      {/* Head office: Dashboard sits at the very top, above the quick actions. */}
      {hoCombined && (() => {
        const pinned = displayGroups.find((g) => g.pinned);
        return pinned ? <div className="mb-1"><GroupItems items={pinned.items} portal={portal} pathname={pathname} multiChild={multiChild} unread={unread} coupons={coupons} caHidden={caHidden} faded={faded} collapsed={collapsed} /></div> : null;
      })()}

      {/* Head office: Find a child + Families live here (not the top bar). They
          open the same franchise-first modals, triggered via a window event the
          Header listens for. */}
      {hoCombined && (
        <div className={`mb-2 flex flex-col gap-1 ${collapsed ? "items-center px-2" : "px-3"}`}>
          {([["🔍", "Find a child", "aos:find-child"], ["👪", "Families", "aos:ho-families"]] as const).map(([icon, label, ev]) => (
            <button
              key={ev}
              type="button"
              onClick={() => window.dispatchEvent(new Event(ev))}
              title={label}
              className={`flex items-center gap-2.5 rounded-lg text-left text-[13px] font-bold transition-colors hover:bg-[var(--side-hover)] ${collapsed ? "h-9 w-9 justify-center" : "px-2.5 py-2"}`}
              style={{ color: "var(--side-ink)" }}
            >
              <span className="flex-none text-[15px] leading-none" aria-hidden>{icon}</span>
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </div>
      )}

      {displayGroups.map((group) => {
        // HO renders its pinned Dashboard above the quick actions already.
        if (hoCombined && group.pinned) return null;
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
