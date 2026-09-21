"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api";

// The provider's own branding for the slide frame + colours (Setup → Branding: accent colour, display name, logo). The portal's
// `--brand-*` variables are only painted for the parent portal (components/shell/ParentBrandTheme.tsx), so a tutor previewing a lesson
// in an operator portal would otherwise see the default blue: this reads the same three fields from the same two places
// (GET /api/me for an operator, /api/my/providers + the public library for a parent) and caches them for the session.

export interface SlideBrand { color?: string; name?: string; logo?: string }

const HEX = /^#[0-9a-fA-F]{6}$/;
let cache: { at: number; p: Promise<SlideBrand> } | null = null;

async function load(): Promise<SlideBrand> {
  try {
    const me = await get<{ tenantId?: string | null; brandColor?: string | null; displayName?: string | null; tenantName?: string | null; logoUrl?: string | null }>("/api/me");
    if (me.tenantId) return { color: me.brandColor && HEX.test(me.brandColor) ? me.brandColor : undefined, name: me.displayName || me.tenantName || undefined, logo: me.logoUrl || undefined };
    const ps = await get<{ tenantId: string; name?: string; logoUrl?: string | null }[]>("/api/my/providers");
    const p = ps?.[0];
    if (!p) return {};
    const lib = await get<{ settings?: { brandColor?: string } } | null>(`/api/public/library/${encodeURIComponent(p.tenantId)}`).catch(() => null);
    const c = lib?.settings?.brandColor;
    return { color: c && HEX.test(c) ? c : undefined, name: p.name || undefined, logo: p.logoUrl || undefined };
  } catch { return {}; }
}

/** The signed-in person's provider brand ({} until loaded / when there is none). */
export function useSlideBrand(): SlideBrand {
  const [b, setB] = useState<SlideBrand>({});
  useEffect(() => {
    let live = true;
    if (!cache || Date.now() - cache.at > 120_000) cache = { at: Date.now(), p: load() };
    cache.p.then((v) => { if (live) setB(v); });
    return () => { live = false; };
  }, []);
  return b;
}
