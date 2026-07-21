"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_GROUPS, type NavIcon, type NavItem, type PortalKey } from "@/lib/nav/config";
import { useAuth } from "@/components/auth/AuthProvider";

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

function NavLink({ item, portal, active }: { item: NavItem; portal: PortalKey; active: boolean }) {
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
      <span className="truncate">{item.label}</span>
      <Badge value={item.badge} />
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

function GroupItems({ items, portal, pathname }: { items: NavItem[]; portal: PortalKey; pathname: string }) {
  return (
    <>
      {items.filter((item) => !item.hidden).map((item) =>
        item.view === "auth" ? (
          <SignOutItem key={item.view} item={item} />
        ) : (
          <NavLink
            key={item.view}
            item={item}
            portal={portal}
            active={pathname === `/${portal}/${item.view}`}
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

  return (
    <nav
      className="flex h-screen w-[248px] flex-none flex-col overflow-y-auto py-4 text-[13px]"
      style={{ background: "var(--side-bg)", color: "var(--side-ink)" }}
    >
      <div
        className="px-4 pb-4 text-[15px] font-extrabold"
        style={{ fontFamily: "var(--ff-display)" }}
      >
        ActivityOS
      </div>

      {groups.map((group) => {
        // A group whose every item is promoted elsewhere (hidden) shows no header.
        if (group.items.every((i) => i.hidden)) return null;
        if (group.pinned || group.footer) {
          return (
            <div
              key={group.label ?? (group.footer ? "__footer" : "__pinned")}
              className={group.footer ? "mb-1 mt-auto border-t border-white/10 pt-2" : "mb-1"}
            >
              <GroupItems items={group.items} portal={portal} pathname={pathname} />
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
              <span>{label}</span>
              <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
            </button>
            {open && (
              <div>
                <GroupItems items={group.items} portal={portal} pathname={pathname} />
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
