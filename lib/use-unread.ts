"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PortalKey } from "@/lib/nav/config";

interface UnreadThread {
  operatorUnread?: number;
  parentUnread?: number;
}

/**
 * Live total of unread messages for the signed-in side. Grows as replies land
 * and drops back to 0 once the thread is opened (opening marks messages read →
 * realtime `threads`/`messages` → this refetches). Shared by the sidebar badge
 * and the top-bar Messages tab so both stay in lock-step.
 */
export function useUnreadMessages(portal: PortalKey): number {
  const [count, setCount] = useState(0);
  const mineUnread = (t: UnreadThread) => (portal === "custdash" ? t.parentUnread : t.operatorUnread) ?? 0;

  const load = useCallback(() => {
    apiGet<UnreadThread[]>("/api/messages/threads")
      .then((ts) => setCount(ts.reduce((sum, t) => sum + ((portal === "custdash" ? t.parentUnread : t.operatorUnread) ?? 0), 0)))
      .catch(() => {});
    // mineUnread is a pure derivation of `portal`; the reducer inlines it to
    // keep the dependency list to just `portal`.
    void mineUnread;
  }, [portal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);
  useRealtime(["threads", "messages"], load);
  return count;
}
