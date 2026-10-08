"use client";

import { usePathname } from "next/navigation";

// Views shared by several operator portals (Team, Schedule, Locations…) used to link to "/company/…" — a dead end
// (PortalGuard bounces you home) for a franchise or a freelancer. This builds the link inside the portal you're in.
const OPERATOR_PORTALS = new Set(["company", "franchise", "freelancer"]);

export function portalOf(pathname: string | null | undefined): string {
  const p = (pathname ?? "").split("/")[1] ?? "";
  return OPERATOR_PORTALS.has(p) ? p : "company";
}

/** Staff and platform (HQ) accounts can look at bookings but not change them, and staff never see prices (the server enforces both;
 *  this only stops the screen offering buttons that would be refused, and prices that are no longer sent). */
export function useReadOnlyPortal(): { readOnly: boolean; staff: boolean } {
  const p = (usePathname() ?? "").split("/")[1] ?? "";
  return { readOnly: p === "staff" || p === "platform", staff: p === "staff" };
}

/** `usePortalHref()("/listings")` → "/franchise/listings" when you're in the franchise portal. */
export function usePortalHref(): (path: string) => string {
  const portal = portalOf(usePathname());
  return (path) => `/${portal}${path.startsWith("/") ? path : `/${path}`}`;
}
