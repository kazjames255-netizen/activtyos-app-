"use client";

import { usePathname } from "next/navigation";
import { findNavItem, type PortalKey } from "@/lib/nav/config";
import { PortalSwitcher } from "./PortalSwitcher";

// Lives in the portal layout (not the per-view page) so it persists across
// view navigation; derives the current view from the URL rather than a prop
// since layouts don't receive their child page's dynamic segment.
export function Header({ portal }: { portal: PortalKey }) {
  const pathname = usePathname();
  const view = pathname.split("/")[2] ?? "";
  const current = findNavItem(portal, view);
  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-5">
      <h1 className="m-0 text-[15px] font-extrabold text-[var(--ink)]">
        {current?.label ?? view}
      </h1>
      <PortalSwitcher portal={portal} />
    </header>
  );
}
