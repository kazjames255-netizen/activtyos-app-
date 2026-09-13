import type { NextFunction, Request, Response } from "express";
import { loadSettings } from "../lib/tenantLibrary";
import { capForApi, capLevel, featureForApi, firstOff, resolveCaps } from "../../../lib/accessMap";
import { isSafeguardingLead } from "../lib/dslAlert";

// Setup → Features and Setup → Roles & permissions, ENFORCED. Both used to be
// decoration: switching Meals off only hid the sidebar link (every Meals API
// still answered, the page loaded by URL — acceptance d2s2), and a role set to
// "None" on an area changed nothing a staff token could fetch (d2s6). The
// tables of what each switch covers live in lib/accessMap.ts, shared with the
// portal's sidebar + view gate.
//
// Runs after attachRole + enforceSubscription on /api (and on the public
// /api/listings mount). Parents and platform are never gated here — parents
// have no tenant of their own, and their pages follow the provider's switches
// through the customer area (lib/use-customer-area.ts).

const TTL_MS = 10_000;
const cache = new Map<string, { at: number; settings: Record<string, unknown> }>();

/** The Setup & features bag that applies to this account — the franchise's own
 *  when it has one (lib/tenantLibrary). Cached briefly: this runs on every
 *  gated request. */
export async function effectiveSettings(tenantId: string, franchiseId?: string | null): Promise<Record<string, unknown>> {
  const key = franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.settings;
  const settings = await loadSettings(tenantId, franchiseId);
  cache.set(key, { at: Date.now(), settings });
  return settings;
}

/** Drop the cached settings for a tenant (and its franchises) — called when
 *  Setup is saved, so a switch takes effect on the next request. */
export function forgetSettings(tenantId: string) {
  for (const k of cache.keys()) if (k === tenantId || k.startsWith(`${tenantId}__fr__`)) cache.delete(k);
}

/** Resolve (and remember on req.auth) the caps binding this account. */
export async function capsFor(req: Request): Promise<Record<string, "none" | "view" | "edit"> | null> {
  const auth = req.auth!;
  if (auth.role !== "staff" || !auth.tenantId) return null;
  if (auth.caps !== undefined) return auth.caps;
  auth.caps = resolveCaps(await effectiveSettings(auth.tenantId, auth.franchiseId), auth.permRole);
  return auth.caps;
}

const GATED = new Set(["company", "freelancer", "franchise", "staff"]);

const AREA_LABEL: Record<string, string> = {
  bookings: "Bookings", customers: "Families", listings: "Listings & blocks", registers: "Registers",
  ratios: "Ratios & groups", meals: "Meals & menus", trips: "Trips & visits", timetable: "the activity timetable",
  calendar: "the events calendar", tasks: "the task manager", medical: "children's medical records",
  incidents: "concerns & first aid", medication: "Medication", moments: "Moments", documents: "Documents",
  finances: "Finances", moneyops: "Money in / out", marketing: "Marketing", messaging: "Messages & newsfeed",
  email: "Email", franchise: "franchise tools",
};

export async function enforceAccess(req: Request, res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth || !auth.tenantId || !GATED.has(auth.role)) { next(); return; }
  const path = req.originalUrl.split("?")[0].replace(/\/+$/, "") || "/";
  const feature = featureForApi(path, req.method);
  const cap = auth.role === "staff" ? capForApi(path, req.method) : null;
  if (!feature && !cap) { next(); return; }
  try {
    if (feature) {
      const features = (await effectiveSettings(auth.tenantId, auth.franchiseId)).features as Record<string, unknown> | undefined;
      const off = firstOff(features, feature.keys);
      if (off) {
        res.status(403).json({
          // "turned off", not "switched off": PortalGuard reads "switched off"
          // as the ACCOUNT being deactivated.
          error: `${feature.label} is turned off for this account. ${auth.role === "staff" ? "Ask a manager to" : "You can"} turn it back on in Setup → Features.`,
          code: "feature_off",
          feature: off,
        });
        return;
      }
    }
    if (cap) {
      const level = capLevel(await capsFor(req), cap.area);
      const what = AREA_LABEL[cap.area] ?? cap.area;
      // The DSL / deputy named in Setup → Safeguarding keeps full safeguarding
      // read/write whatever their role's matrix says (s13-fx5-dsl, decided by
      // Kaz 13 Sept) — routes/incidents.ts decides what they can open.
      if (cap.area === "incidents" && (level === "none" || (cap.need === "edit" && level === "view")) && (await isSafeguardingLead(auth, req.user?.email))) { next(); return; }
      if (level === "none") {
        res.status(403).json({ error: `Your role doesn't have access to ${what}. A manager can change this in Setup → Roles & permissions.`, code: "no_access", area: cap.area });
        return;
      }
      if (cap.need === "edit" && level === "view") {
        res.status(403).json({ error: `Your role can view ${what} but not change it. A manager can change this in Setup → Roles & permissions.`, code: "view_only", area: cap.area });
        return;
      }
    }
  } catch (e) {
    // Settings unreadable: don't lock the whole team out over it — every
    // route's own tenant/role checks still run.
    console.error("[access] settings lookup failed:", (e as Error).message);
  }
  next();
}
