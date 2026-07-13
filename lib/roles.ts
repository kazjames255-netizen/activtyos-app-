import { get as apiGet } from "./api";

export interface Me {
  email: string | null;
  role: "platform" | "company" | "franchise" | "freelancer" | "staff" | "parent";
  tenantId: string | null;
  tenantName: string | null;
  franchiseId: string | null;
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

export async function fetchRoleHome(): Promise<string> {
  try {
    const me = await apiGet<Me>("/api/me");
    return ROLE_HOME[me.role] ?? "/custdash/browse";
  } catch {
    // API unreachable or account not provisioned — pick a safe default.
    return "/custdash/browse";
  }
}
