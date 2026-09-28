"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, type LocaleCode } from "./config";

// The Teaching Hub's message catalogues load ON DEMAND, one locale at a time (+ English, the fallback), instead of riding in the main
// bundle of every page: they are about half of all message text (~7MB source across 11 locales). `t("hub…")` calls that arrive before
// the catalogue does return "" (never a raw key) and trigger the load; the provider re-renders when it lands (see subscribeHub).
type Dict = Record<string, string>;
type Cat = Record<string, Dict>;

const loaded: Partial<Record<LocaleCode, Cat>> = {};
const inflight = new Map<LocaleCode, Promise<void>>();
const failed = new Set<LocaleCode>();
const subs = new Set<() => void>();
const notify = () => { for (const f of subs) f(); };

export const isHubKey = (key: string) => /^hub[a-z]*\./.test(key);
export const subscribeHub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** True once English and `locale` are both here (or the load failed for good — then keys fall back to English / the key). */
export const hubReady = (locale: LocaleCode) => (!!loaded.en || failed.has("en")) && (!!loaded[locale] || failed.has(locale));

export function lookupHub(locale: LocaleCode, key: string): string | undefined {
  const dot = key.indexOf(".");
  const ns = key.slice(0, dot), k = key.slice(dot + 1);
  return loaded[locale]?.[ns]?.[k] ?? loaded.en?.[ns]?.[k];
}

async function fetchOne(l: LocaleCode): Promise<void> {
  try {
    // A build id in the URL (next.config.ts) so a new deploy never reads the previous build's cached catalogue (a key added since would show raw,
    // e.g. "hubhow.showMe", until the stale copy revalidated); in development the copy is never cached at all, so a key added while the dev server runs shows at once.
    const v = process.env.NEXT_PUBLIC_BUILD_ID;
    const r = await fetch(`/i18n/hub/${l}${v ? `?v=${v}` : ""}`, process.env.NODE_ENV === "production" ? undefined : { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    loaded[l] = (await r.json()) as Cat;
  } catch {
    // Route unreachable (offline blip, odd deploy): fall back to bundling the source catalogue as a lazy chunk — slower, never broken.
    try { loaded[l] = (await import("./messages/hub")).hubCatalog(l); } catch { failed.add(l); }
  }
}

/** Start loading English + `locale` (idempotent, shared). */
export function loadHub(locale: LocaleCode): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const want: LocaleCode[] = locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [DEFAULT_LOCALE, locale];
  return Promise.all(want.map((l) => {
    if (loaded[l] || failed.has(l)) return Promise.resolve();
    let p = inflight.get(l);
    if (!p) { p = fetchOne(l).finally(() => { inflight.delete(l); notify(); }); inflight.set(l, p); }
    return p;
  })).then(() => undefined);
}

/** For hub screens that must not paint before their words exist: starts the load and reports when it is ready. */
export function useHubMessagesReady(locale: LocaleCode): boolean {
  const [, bump] = useState(0);
  useEffect(() => subscribeHub(() => bump((n) => n + 1)), []);
  useEffect(() => { void loadHub(locale); }, [locale]);
  return hubReady(locale);
}
