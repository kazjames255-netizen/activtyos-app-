import { getHoScopeId, HO_OWN } from "@/components/franchise/HoScope";
import { peekMe } from "@/components/auth/PortalGuard";

// Append the active head-office network scope to an API URL as ?franchiseId=, so
// a request reads only that slice. A set scope (a franchise, or HO_OWN =
// "__ho__" own locations) narrows it; the "all franchises" scope is null → no
// param → the whole tenant. Non-HO portals never have a scope set → no-op.
// Backend honours it via applyHoNetFilter (server/src/lib/franchiseScope.ts).
// Used where "all network" is the right default (e.g. comms to every family).
export function withHoNet(url: string): string {
  const s = getHoScopeId();
  if (!s) return url;
  return `${url}${url.includes("?") ? "&" : "?"}franchiseId=${encodeURIComponent(s)}`;
}

// Money LEDGERS (expenses / income / invoices / POs) are different: a head
// office's books are its OWN — the network-wide totals live in Split fees and
// the command centre. So in the combined view (no explicit scope) default to the
// head-office own slice rather than mixing every franchise's money together.
// Drilling into a franchise (or HO own-locations) still follows that scope.
export function withHoMoney(url: string): string {
  let s = getHoScopeId();
  if (!s && peekMe()?.hasFranchises) s = HO_OWN; // combined HO view → own books
  if (!s) return url;
  return `${url}${url.includes("?") ? "&" : "?"}franchiseId=${encodeURIComponent(s)}`;
}
