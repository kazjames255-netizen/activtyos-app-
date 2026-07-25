"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { post as apiPost } from "@/lib/api";

const OPERATOR = new Set(["freelancer", "company", "franchise"]);

/**
 * Records how long an operator spends on each page (for HQ's Page-engagement
 * view). On every route change — and when the tab is hidden — it flushes the
 * time spent on the page just left. Very short (<2s) or idle-long (>30m) visits
 * are dropped. Fire-and-forget; failures are ignored.
 */
export function PageTracker({ portal }: { portal: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!OPERATOR.has(portal)) return;
    const view = pathname.split("/")[2] || "home";
    const startedAt = Date.now();
    const send = () => {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      if (seconds >= 2 && seconds <= 1800) void apiPost("/api/analytics/pageview", { view, seconds }).catch(() => {});
    };
    const onHide = () => { if (document.visibilityState === "hidden") send(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); send(); };
  }, [pathname, portal]);

  return null;
}
