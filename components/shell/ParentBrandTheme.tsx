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
    apiGet<{ brandColor?: string | null }>("/api/me")
      .then((me) => {
        if (cancelled) return;
        const vars = brandVars(me.brandColor);
        const root = document.documentElement;
        for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
        applied = Object.keys(vars);
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
