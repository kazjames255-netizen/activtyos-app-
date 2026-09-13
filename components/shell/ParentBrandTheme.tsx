"use client";

import { useEffect } from "react";
import { get as apiGet } from "@/lib/api";
import { brandVars } from "@/lib/brand-theme";

// Paints the provider's chosen accent onto the parent portal (and the checkout
// it hosts) by overriding the `--brand-*` CSS variables on the document root.
// Rendered only for the custdash portal, so the operator/HO chrome is untouched;
// it removes the overrides on unmount, so navigating to another portal falls
// straight back to the default palette in globals.css.
export function ParentBrandTheme() {
  useEffect(() => {
    let applied: string[] = [];
    let cancelled = false;
    const apply = (hex: string | null | undefined) => {
      if (cancelled) return;
      const vars = brandVars(hex);
      const root = document.documentElement;
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
      applied = Object.keys(vars);
    };
    apiGet<{ brandColor?: string | null; tenantId?: string | null }>("/api/me")
      .then(async (me) => {
        // An operator (viewing the parent portal) carries their own colour on /api/me.
        if (me.tenantId || me.brandColor) return apply(me.brandColor);
        // A parent has no tenant, so /api/me has no colour: use their provider's
        // public settings (Phase 1 is single-provider — the first one).
        const ps = await apiGet<{ tenantId: string }[]>("/api/my/providers");
        const tid = ps?.[0]?.tenantId;
        if (!tid) return;
        const lib = await apiGet<{ settings?: { brandColor?: string } } | null>(`/api/public/library/${encodeURIComponent(tid)}`);
        apply(lib?.settings?.brandColor);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      const root = document.documentElement;
      for (const k of applied) root.style.removeProperty(k);
    };
  }, []);
  return null;
}
