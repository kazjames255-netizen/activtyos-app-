"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useTenantSettings, type TenantSettings } from "@/lib/settings";
import type { PortalKey } from "@/lib/nav/config";

export type CustomerArea = TenantSettings["customerArea"];

// The only custdash views kept when the provider turns on Simple mode — the
// booking essentials: home, view/book activities, bookings, child profiles,
// account/privacy, and "report a problem". Everything else is hidden.
export const SIMPLE_ALLOWED = new Set(["dash", "browse", "bookings", "children", "account", "privacy", "activityos"]);

// What a family sees is set by THEIR provider (Setup → Customer area). A parent
// reads it from their single provider's public library. Everything defaults to
// shown until the settings load, so nothing flickers away and back.
export function useCustomerArea(portal?: PortalKey): CustomerArea {
  const [tenantId, setTenantId] = useState<string | undefined>();
  useEffect(() => {
    if (portal && portal !== "custdash") return; // only families have a provider to read
    apiGet<{ tenantId: string }[]>("/api/my/providers")
      .then((ps) => setTenantId(ps?.[0]?.tenantId))
      .catch(() => {});
  }, [portal]);
  const { settings } = useTenantSettings(tenantId);
  return settings.customerArea;
}
