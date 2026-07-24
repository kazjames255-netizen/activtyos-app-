"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { DEFAULT_SETTINGS, withDefaults, type TenantSettings } from "@/lib/settings";
import type { PortalKey } from "@/lib/nav/config";

export type CustomerArea = TenantSettings["customerArea"];
export type Features = TenantSettings["features"]; // { [navView]: boolean } — absent/true = shown

// The dashboard views that can NEVER be switched off (Setup → Features lists
// everything else). Covers the essentials for running plus the pieces that go
// into setting up a listing (blocks/availability, locations/venues). Auth and
// the operator's own account are always kept too.
export const CORE_VIEWS = new Set([
  "dash", "dashboard", "bookings", "listings", "blocks", "locations",
  "customers", "finance", "setup", "account", "privacy", "auth",
]);

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
  const load = useCallback(() => {
    if (portal && portal !== "custdash") return;
    void apiGet<{ tenantId: string }[]>("/api/my/providers")
      .then((ps) => ps?.[0]?.tenantId)
      .then((tid) => (tid ? apiGet<{ settings?: Partial<TenantSettings> } | null>(`/api/public/library/${tid}`) : null))
      .then((lib) => {
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
  }, [portal]);
  useEffect(() => { load(); }, [load]);
  // Live: the provider's library streams to families (see events.ts parent
  // branch), so switching a module off updates their nav without a refresh.
  useRealtime(["library"], load);
  return ca;
}

// The operator's own module switches (Setup → Features), for hiding their nav.
// Live-refetches on library changes; a no-op for families/staff/platform.
export function useOperatorFeatures(portal?: PortalKey): Features {
  const [fe, setFe] = useState<Features>(DEFAULT_SETTINGS.features);
  const active = !!portal && portal !== "custdash" && portal !== "platform" && portal !== "staff";
  const load = useCallback(() => {
    if (!active) return;
    void apiGet<{ settings?: Partial<TenantSettings> } | null>("/api/library")
      .then((lib) => setFe(withDefaults(lib?.settings ?? null).features))
      .catch(() => {});
  }, [active]);
  useEffect(() => { load(); }, [load]);
  useRealtime(["library"], load);
  return fe;
}

// Which Money sides the operator wants shown (Setup → Money). Drives nav
// hiding of the incoming (Invoices) vs outgoing (Expenses, Bills/POs) views.
export function useMoneyShow(portal?: PortalKey): "outgoing" | "incoming" | "both" {
  const [show, setShow] = useState<"outgoing" | "incoming" | "both">("both");
  const active = !!portal && portal !== "custdash" && portal !== "platform" && portal !== "staff";
  const load = useCallback(() => {
    if (!active) return;
    void apiGet<{ settings?: Partial<TenantSettings> } | null>("/api/library")
      .then((lib) => setShow(withDefaults(lib?.settings ?? null).money?.show ?? "both"))
      .catch(() => {});
  }, [active]);
  useEffect(() => { load(); }, [load]);
  useRealtime(["library"], load);
  return show;
}

// Bills & Invoices is one combined page that adapts to the chosen side, so it's
// never hidden. Only the standalone outgoing view (Expenses) is hidden when the
// operator picks incoming-only; there's no standalone incoming view to hide.
export const MONEY_OUTGOING_VIEWS = ["expenses"];
export const MONEY_INCOMING_VIEWS: string[] = [];
