"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { errMsg } from "../types";

/** GET a hub path (null = don't fetch), refetch on realtime changes, keep the
 *  last good data while refetching. `error` is the last failure (cleared on success). */
/** Fired after the tenant's attainment levels are saved, so every open view refetches. */
export const LEVELS_CHANGED = "hub:levels-changed";

export function useHubData<T>(path: string | null, channels: string[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) { setData(null); setLoading(false); return; }
    const mine = ++seq.current;
    try {
      const d = await get<T>(path);
      if (mine !== seq.current) return;
      setData(d); setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(errMsg(e, "Couldn't load that"));
    } finally { if (mine === seq.current) setLoading(false); }
  }, [path]);

  useEffect(() => { setData(null); setLoading(!!path); setError(null); void load(); }, [load, path]);
  const onChange = useCallback(() => { void load(); }, [load]);
  useRealtime(channels, onChange);
  // Level names / thresholds changed ("Edit levels"): anything already fetched carries the OLD labels
  // (bands are worked out server-side per response), so refetch instead of showing stale ones.
  useEffect(() => {
    const h = () => { void load(); };
    window.addEventListener(LEVELS_CHANGED, h);
    return () => window.removeEventListener(LEVELS_CHANGED, h);
  }, [load]);
  return { data, loading, error, reload: load, setData };
}

/** Element width in px (0 until measured) — lets SVG charts draw at real pixel size.
 *  Returns a callback ref so it also works when the element mounts later. */
export function useWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w] as const;
}
