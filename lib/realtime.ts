"use client";

import { useEffect } from "react";
import { firebaseAuth } from "./firebase/client";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Subscribe to the API's realtime invalidation stream (SSE). `onChange`
 * fires whenever one of the named collections changes within the signed-in
 * account's scope — the caller refetches through the normal API. Returns an
 * unsubscribe function. Reconnects automatically with a fresh ID token
 * (tokens expire hourly, and EventSource URLs are fixed at construction).
 */
export function subscribeRealtime(collections: string[], onChange: () => void): () => void {
  let es: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  async function connect() {
    if (stopped) return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      retry = setTimeout(connect, 3000);
      return;
    }
    let token: string;
    try {
      token = await user.getIdToken();
    } catch {
      retry = setTimeout(connect, 3000);
      return;
    }
    if (stopped) return;
    es = new EventSource(`${BASE}/api/events?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      try {
        const { collection } = JSON.parse(e.data) as { collection: string };
        if (collections.includes(collection)) onChange();
      } catch {
        /* ignore malformed events */
      }
    };
    es.onerror = () => {
      es?.close();
      es = null;
      if (!stopped) retry = setTimeout(connect, 3000);
    };
  }

  void connect();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    es?.close();
  };
}

/** React hook flavour: live-refetch while the component is mounted. */
export function useRealtime(collections: string[], onChange: () => void): void {
  useEffect(
    () => subscribeRealtime(collections, onChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collections.join(","), onChange],
  );
}
