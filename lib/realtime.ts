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
// ONE shared connection for the whole app, fanned out to every subscriber.
// An EventSource holds a socket open for as long as it lives, and browsers
// allow only ~6 per origin over HTTP/1.1 — so opening one per component (with
// StrictMode double-mounts and Fast Refresh remounts on top) exhausted the
// pool and left every later fetch queued forever.
type Listener = { collections: string[]; onChange: () => void };

const listeners = new Set<Listener>();
let es: EventSource | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let connecting = false;

function scheduleRetry() {
  if (retry || listeners.size === 0) return;
  retry = setTimeout(() => {
    retry = null;
    void connect();
  }, 3000);
}

async function connect() {
  if (es || connecting || listeners.size === 0) return;
  connecting = true;
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return scheduleRetry();
    let token: string;
    try {
      token = await user.getIdToken();
    } catch {
      return scheduleRetry();
    }
    // Everyone may have unsubscribed while we awaited the token.
    if (listeners.size === 0 || es) return;
    es = new EventSource(`${BASE}/api/events?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      try {
        const { collection } = JSON.parse(e.data) as { collection: string };
        for (const l of listeners) if (l.collections.includes(collection)) l.onChange();
      } catch {
        /* ignore malformed events */
      }
    };
    es.onerror = () => {
      es?.close();
      es = null;
      scheduleRetry();
    };
  } finally {
    connecting = false;
  }
}

function closeIfIdle() {
  if (listeners.size > 0) return;
  if (retry) {
    clearTimeout(retry);
    retry = null;
  }
  es?.close();
  es = null;
}

export function subscribeRealtime(collections: string[], onChange: () => void): () => void {
  const listener: Listener = { collections, onChange };
  listeners.add(listener);
  void connect();
  return () => {
    listeners.delete(listener);
    closeIfIdle();
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
