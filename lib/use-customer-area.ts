"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { DEFAULT_SETTINGS, withDefaults, type TenantSettings } from "@/lib/settings";
import type { PortalKey } from "@/lib/nav/config";

export type CustomerArea = TenantSettings["customerArea"];

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
        // "Refer a friend" only shows when the provider actually runs referrals.
        setCa({ ...full.customerArea, refer: full.customerArea.refer && full.referral.enabled });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [portal]);
  return ca;
}
