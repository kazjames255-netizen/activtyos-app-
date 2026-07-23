"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { DEFAULT_SETTINGS, withDefaults, type TenantSettings } from "@/lib/settings";
import type { PortalKey } from "@/lib/nav/config";

export type CustomerArea = TenantSettings["customerArea"];
export type Features = TenantSettings["features"]; // { [navView]: boolean } — absent/true = shown

// The dashboard views that can NEVER be switched off (Setup → Features lists
// everything else). Auth (sign out) is always kept too.
export const CORE_VIEWS = new Set(["dash", "bookings", "listings", "customers", "finance", "setup", "auth"]);

// A view is hidden only when explicitly false.
export const featureOff = (features: Features | undefined, view: string) => features?.[view] === false;

// The only custdash views kept when the provider turns on Simple mode — the
// booking essentials: home, view/book activities, bookings, child profiles,
// account/privacy, and "report a problem". Everything else is hidden.
export const SIMPLE_ALLOWED = new Set(["dash", "browse", "bookings", "children", "account", "privacy", "activityos"]);

// What a family sees is set by THEIR provider (Setup → Customer area). A parent
// reads it from their single provider's PUBLIC library slice.
//
// This deliberately does NOT touch /api/library or useTenantSettings: operators
// (portal !== custdash) never read a provider's customer area, so the hook makes
// zero network calls for them. For a family it makes exactly one providers read
// and one public-library read. Everything defaults to shown until it loads.
export function useCustomerArea(portal?: PortalKey): CustomerArea {
  const [ca, setCa] = useState<CustomerArea>(DEFAULT_SETTINGS.customerArea);
  useEffect(() => {
    if (portal && portal !== "custdash") return;
    let live = true;
    void apiGet<{ tenantId: string }[]>("/api/my/providers")
      .then((ps) => ps?.[0]?.tenantId)
      .then((tid) => (tid ? apiGet<{ settings?: Partial<TenantSettings> } | null>(`/api/public/library/${tid}`) : null))
      .then((lib) => {
        if (!live) return;
        const full = withDefaults(lib?.settings ?? null);
        const ca = { ...full.customerArea };
        const fe = full.features;
        // A module the operator switched off (Setup → Features, keyed by their
        // nav view) is hidden for families too. Refer also needs the referral
        // programme actually on.
        if (featureOff(fe, "messages")) ca.messaging = false;
        if (featureOff(fe, "marketing")) { ca.coupons = false; ca.codesBanner = false; }
        if (featureOff(fe, "newsfeed")) ca.newsfeed = false;
        if (featureOff(fe, "moments")) ca.moments = false;
        if (featureOff(fe, "meals")) ca.meals = false;
        if (featureOff(fe, "memberships")) ca.memberships = false;
        ca.refer = ca.refer && full.referral.enabled && !featureOff(fe, "referrals");
        setCa(ca);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [portal]);
  return ca;
}

// The operator's own module switches (Setup → Features), for hiding their nav.
// Reads their library once; a no-op for families/staff/platform.
export function useOperatorFeatures(portal?: PortalKey): Features {
  const [fe, setFe] = useState<Features>(DEFAULT_SETTINGS.features);
  useEffect(() => {
    if (!portal || portal === "custdash" || portal === "platform" || portal === "staff") return;
    let live = true;
    void apiGet<{ settings?: Partial<TenantSettings> } | null>("/api/library")
      .then((lib) => { if (live) setFe(withDefaults(lib?.settings ?? null).features); })
      .catch(() => {});
    return () => { live = false; };
  }, [portal]);
  return fe;
}
