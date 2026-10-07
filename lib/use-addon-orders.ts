"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PortalKey } from "@/lib/nav/config";

// Does this provider have LIVE add-on orders (a confirmed booking with an extra still to prepare today or later)? The "Add-on orders" sidebar item
// and the Dashboard card show ONLY when it does. One shared answer per minute (module level) so the sidebar, the phone "More" sheet and the
// Dashboard make a single request between them; the server caches it for a minute too (routes/kit.ts /live).

const OPERATOR = new Set<PortalKey>(["company", "franchise", "freelancer", "staff"]);
const TTL_MS = 60_000;
let cache: { portal: PortalKey; at: number; live: boolean } | null = null;
let inflight: { portal: PortalKey; p: Promise<boolean> } | null = null;
const listeners = new Set<(live: boolean) => void>();

export function addonOrdersLive(portal: PortalKey, force = false): Promise<boolean> {
  if (!OPERATOR.has(portal)) return Promise.resolve(false);
  if (!force && cache && cache.portal === portal && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.live);
  if (inflight && inflight.portal === portal) return inflight.p;
  const p = apiGet<{ live?: boolean }>("/api/kit/live")
    .then((r) => !!r?.live)
    .catch(() => false)
    .then((live) => {
      cache = { portal, at: Date.now(), live };
      inflight = null;
      listeners.forEach((f) => f(live));
      return live;
    });
  inflight = { portal, p };
  return p;
}

/** True once we know the provider has live add-on orders (hidden until then, so the menu never flashes). */
export function useAddonOrdersLive(portal: PortalKey): boolean {
  const [live, setLive] = useState(() => (cache && cache.portal === portal ? cache.live : false));
  useEffect(() => {
    if (!OPERATOR.has(portal)) return;
    const f = (v: boolean) => setLive(v);
    listeners.add(f);
    // Let the page's own data go first (the same courtesy the other sidebar checks give).
    const timer = setTimeout(() => { void addonOrdersLive(portal).then(setLive); }, 1200);
    return () => { clearTimeout(timer); listeners.delete(f); };
  }, [portal]);
  // An order placed or cancelled while the page is open: ask again shortly (debounced: a burst of changes is one request).
  const refresh = useCallback(() => { void addonOrdersLive(portal, true); }, [portal]);
  useRealtime(["bookings"], refresh);
  return live;
}
