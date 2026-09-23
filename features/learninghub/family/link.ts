"use client";

import { useMemo, useSyncExternalStore } from "react";

// URL-addressable Learning Hub state for a family:
//   ?tab=quizzes&child=<childId>&open=quiz:<assessmentId>[&hw=<homeworkId>]
//   ?tab=notes&child=<childId>&open=lesson:<noteId>[&hw=<homeworkId>]
//   ?tab=homework&child=<childId>&open=hw:<homeworkId>
// A refresh restores it, a shared/notification link lands on it, and Back closes an opened lesson / quiz / homework
// instead of leaving the hub. Opening PUSHES a history entry (tagged in history.state); closing goes Back when the current
// entry is one we pushed, otherwise (a deep-link landing) it just rewrites the URL.
//
// history.state is always carried over: Next's router keeps its own bookkeeping there (__NA …), and an entry without it
// makes the router hard-reload on Back.

export type OpenKind = "quiz" | "lesson" | "hw" | "doubt";
export interface OpenRef { kind: OpenKind; id: string }

const EVT = "aos-hub-link";
const MARK = "aosHubOpen";

const currentSearch = () => (typeof window === "undefined" ? "" : window.location.search);
const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVT, cb);
  return () => { window.removeEventListener("popstate", cb); window.removeEventListener(EVT, cb); };
};

/** The live `location.search` (re-renders on push / replace / Back). */
export function useLinkSearch(): string {
  return useSyncExternalStore(subscribe, currentSearch, () => "");
}

export function parseOpen(raw: string | null | undefined): OpenRef | null {
  const m = /^(quiz|lesson|hw|doubt):([A-Za-z0-9_-]{1,100})$/.exec(raw ?? "");
  return m ? { kind: m[1] as OpenKind, id: m[2] } : null;
}

export function readLink(search: string = currentSearch()): { tab: string | null; child: string | null; open: OpenRef | null; hw: string | null } {
  const p = new URLSearchParams(search);
  return { tab: p.get("tab"), child: p.get("child"), open: parseOpen(p.get("open")), hw: p.get("hw") };
}

/** The `open=` target when it is of `kind` (else null), and the homework it was opened from. */
export function useLinkOpen(kind: OpenKind): { id: string | null; hw: string | null } {
  const s = useLinkSearch();
  return useMemo(() => { const l = readLink(s); return { id: l.open?.kind === kind ? l.open.id : null, hw: l.hw }; }, [s, kind]);
}

const stateWith = (extra: Record<string, unknown>) => ({ ...(window.history.state ?? {}), ...extra });
function commit(u: URL, how: "push" | "replace", mark: boolean | null) {
  try {
    const st = mark === null ? window.history.state : stateWith({ [MARK]: mark });
    if (how === "push") window.history.pushState(st, "", u); else window.history.replaceState(st, "", u);
  } catch { /* the URL is a nicety */ }
  window.dispatchEvent(new Event(EVT));
}

/** Open a lesson / quiz / homework: a new history entry, with the tab (and the homework it came from) in the URL. */
export function openLink(ref: OpenRef, opts?: { tab?: string; hw?: string | null }) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  if (opts?.tab) u.searchParams.set("tab", opts.tab);
  u.searchParams.set("open", `${ref.kind}:${ref.id}`);
  if (opts?.hw) u.searchParams.set("hw", opts.hw); else u.searchParams.delete("hw");
  if (u.search === window.location.search) return;
  commit(u, "push", true);
}

/** Close whatever `open=` names. Back when we pushed the entry; a plain URL rewrite for a deep-link landing. */
export function closeLink() {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  if (!u.searchParams.has("open")) return;
  if ((window.history.state as Record<string, unknown> | null)?.[MARK] === true) { window.history.back(); return; }
  u.searchParams.delete("open"); u.searchParams.delete("hw");
  commit(u, "replace", null);
}

/** Switch tab (or child) in place: drops any `open=` (a different tab never shows the old lesson) without adding history. */
export function setLinkParams(patch: { tab?: string | null; child?: string | null }, dropOpen = false) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) { if (v) u.searchParams.set(k, v); else if (v === null) u.searchParams.delete(k); }
  if (dropOpen) { u.searchParams.delete("open"); u.searchParams.delete("hw"); }
  if (u.search === window.location.search) return;
  commit(u, "replace", dropOpen ? false : null);
}

/** A ready-to-use path for a lesson / quiz / homework (notifications, emails, "send Ava straight to this"). */
export function hubLinkPath(base: string, o: { tab: string; child?: string | null; open?: OpenRef | null; hw?: string | null }): string {
  const p = new URLSearchParams({ tab: o.tab });
  if (o.child) p.set("child", o.child);
  if (o.open) p.set("open", `${o.open.kind}:${o.open.id}`);
  if (o.hw) p.set("hw", o.hw);
  return `${base}?${p.toString()}`;
}
