import { get as apiGet } from "./api";

export interface Me {
  email: string | null;
  /** The signed-in person's display name (users doc), returned by /api/me. */
  name?: string;
  role: "platform" | "company" | "franchise" | "freelancer" | "staff" | "parent";
  tenantId: string | null;
  tenantName: string | null;
  /** What families see the provider called (Setup → Display name); the portal brand uses it. */
  displayName?: string | null;
  /** The operator's own logo (settings.billing.logoUrl), for the portal chrome. */
  logoUrl?: string | null;
  /** The parent's postcode from signup — seeds the browse distance search. */
  postcode?: string | null;
  /** Has the parent seen the first-login welcome popup? */
  welcomed?: boolean;
  franchiseId: string | null;
  /** Staff only: a lead — passes every "leads only" setting. */
  lead?: boolean;
  /** Staff only: their Setup → Roles & permissions role id. */
  permRole?: string | null;
  /** Staff only: what that role may do per area (null = not restricted). The
   *  API enforces it; the sidebar + view gate just follow (lib/accessMap.ts). */
  caps?: Record<string, "none" | "view" | "edit"> | null;
  /** Franchise only: head-office-granted business name + territory (e.g. "London"). */
  franchiseName?: string | null;
  franchiseArea?: string | null;
  /** Company (head office) only: whether it has ≥1 franchise — gates franchisor tools. */
  hasFranchises?: boolean;
}

// Each role's home — where a fresh sign-in lands.
export const ROLE_HOME: Record<Me["role"], string> = {
  platform: "/platform/providers",
  company: "/company/bookings",
  franchise: "/franchise/bookings",
  freelancer: "/freelancer/bookings",
  staff: "/staff/dash",
  parent: "/custdash/browse",
};

// Which portals each role may open ("all" = platform's cross-portal preview).
// Enforced client-side by PortalGuard for UX — the API enforces data access
// regardless.
export const PORTAL_ACCESS: Record<Me["role"], "all" | string[]> = {
  platform: "all",
  company: ["company"],
  franchise: ["franchise"],
  freelancer: ["freelancer"],
  staff: ["staff"],
  parent: ["custdash"],
};

/**
 * Where this account's sign-in should land — or `null` when we can't tell.
 *
 * Returning null matters. This used to fall back to "/custdash/browse" whenever
 * `/api/me` failed, which meant that if the API was simply down, an OPERATOR was
 * dropped into the PARENT portal: a provider signing in as their business landed
 * on "Browse activities" with a My-child sidebar and one red error in the body.
 * Guessing a portal when the role is unknown isn't a safe default, it's a wrong
 * answer delivered confidently — so say we don't know and let the caller ask
 * the person to retry.
 */
export async function fetchRoleHome(): Promise<string | null> {
  try {
    const me = await apiGet<Me>("/api/me");
    return ROLE_HOME[me.role] ?? null;
  } catch {
    return null;
  }
}
