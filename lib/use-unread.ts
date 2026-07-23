"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PortalKey } from "@/lib/nav/config";

interface UnreadThread {
  operatorUnread?: number;
  parentUnread?: number;
}

// A process-wide shared loader so that the several places reading the unread
// count (sidebar badge + top-bar Messages tab, and any future consumer) collapse
// into ONE `/api/messages/threads` request instead of one each. On a Firestore
// free-tier quota that difference is the gap between "fine" and "quota exceeded",
// and it's just good hygiene regardless. In-flight requests are shared; a short
// TTL absorbs the mount burst; realtime events force a fresh read.
const TTL_MS = 4000;
let cached: UnreadThread[] | null = null;
let cachedAt = 0;
let inflight: Promise<UnreadThread[]> | null = null;

function loadThreadsShared(force: boolean): Promise<UnreadThread[]> {
  if (!force && cached && Date.now() - cachedAt < TTL_MS) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = apiGet<UnreadThread[]>("/api/messages/threads")
    .then((ts) => {
      cached = ts;
      cachedAt = Date.now();
      return ts;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Live total of unread messages for the signed-in side. Grows as replies land
 * and drops back to 0 once the thread is opened (opening marks messages read →
 * realtime `threads`/`messages` → this refetches). Shared by the sidebar badge
 * and the top-bar Messages tab so both stay in lock-step — and share one fetch.
 */
export function useUnreadMessages(portal: PortalKey): number {
  const [count, setCount] = useState(0);

  const apply = useCallback(
    (ts: UnreadThread[]) =>
      setCount(ts.reduce((sum, t) => sum + ((portal === "custdash" ? t.parentUnread : t.operatorUnread) ?? 0), 0)),
    [portal],
  );

  const load = useCallback((force: boolean) => {
    loadThreadsShared(force).then(apply).catch(() => {});
  }, [apply]);

  useEffect(() => { load(false); }, [load]);
  // Realtime updates must reflect a genuine change, so bypass the TTL cache.
  useRealtime(["threads", "messages"], () => load(true));
  return count;
}

// Shared count of usable discount codes for the signed-in parent — powers the
// "Coupons & discount codes" nav badge. Same shape as the unread loader (shared
// in-flight + short TTL) so several consumers collapse into one request.
let couponCache: number | null = null;
let couponAt = 0;
let couponInflight: Promise<number> | null = null;

function loadCouponCountShared(force: boolean): Promise<number> {
  if (!force && couponCache !== null && Date.now() - couponAt < TTL_MS) return Promise.resolve(couponCache);
  if (couponInflight) return couponInflight;
  couponInflight = apiGet<unknown[]>("/api/my/coupons")
    .then((r) => { couponCache = Array.isArray(r) ? r.length : 0; couponAt = Date.now(); return couponCache; })
    .finally(() => { couponInflight = null; });
  return couponInflight;
}

/** Live count of discount codes the family can use right now (custdash only). */
export function useCouponCount(portal: PortalKey): number {
  const [count, setCount] = useState(0);
  const load = useCallback((force: boolean) => {
    if (portal !== "custdash") { setCount(0); return; }
    loadCouponCountShared(force).then(setCount).catch(() => {});
  }, [portal]);
  useEffect(() => { load(false); }, [load]);
  useRealtime(["discountCodes", "bookings"], () => load(true));
  return portal === "custdash" ? count : 0;
}
