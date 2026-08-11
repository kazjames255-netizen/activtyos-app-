"use client";

import { useEffect } from "react";
import { firebaseAuth } from "./firebase/client";
import { isDemoMode } from "./api";

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
// Collections the current EventSource was opened watching. The server only
// attaches Firestore listeners for these (each attach costs a full-collection
// read), so we pass the union of what mounted views need. The set only ever
// GROWS across a session — that keeps navigation from tearing the socket down
// and re-paying the read on every unmount; it converges to the handful of
// collections actually visited rather than all ~35.
let attachedCols = new Set<string>();

function neededCols(): Set<string> {
  const s = new Set<string>();
  for (const l of listeners) for (const c of l.collections) s.add(c);
  return s;
}

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
    attachedCols = neededCols();
    const cols = [...attachedCols].sort().join(",");
    es = new EventSource(`${BASE}/api/events?token=${encodeURIComponent(token)}${cols ? `&collections=${encodeURIComponent(cols)}` : ""}`);
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
  // If this view needs a collection the open socket isn't watching, reopen it
  // once with the widened set. (Only reopens on growth, so this happens at most
  // a few times per session, not on every mount.)
  if (es && collections.some((c) => !attachedCols.has(c))) {
    es.close();
    es = null;
  }
  void connect();
  return () => {
    listeners.delete(listener);
    closeIfIdle();
  };
}

/** React hook flavour: live-refetch while the component is mounted. */
export function useRealtime(collections: string[], onChange: () => void): void {
  useEffect(
    () => {
      // In a guided-tour demo document there's no auth and no live data to
      // invalidate — the fixtures are static, so never open a socket.
      if (isDemoMode()) return;
      return subscribeRealtime(collections, onChange);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collections.join(","), onChange],
  );
}
