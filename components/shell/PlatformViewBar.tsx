"use client";

// A can't-miss bar for the OTHER way a platform (HQ super-admin) account can
// end up looking at tenant-scoped operator screens, distinct from
// ImpersonationBar's "viewing AS someone": PortalGuard lets a platform
// account open any operator portal for a cross-portal preview even when it
// ISN'T impersonating anyone (components/auth/PortalGuard.tsx accessOk — the
// account genuinely has no tenant of its own). The data routes still answer
// role:"platform" requests with no tenant filter — which means EVERY
// tenant's rows, merged into one ordinary-looking list (real business and
// family/child names, no tenant column, no indication it isn't one
// provider's data). That's intentional — HQ needs to see across tenants to
// spot issues — but it was silent. Same visual treatment as
// ImpersonationBar for consistency; they're mutually exclusive (this hides
// itself the moment an account is opened via "HQ → Open account").
import { useEffect, useState } from "react";
import { getActAs } from "@/lib/api";
import { getMe } from "@/components/auth/PortalGuard";

const TENANT_PORTALS = new Set(["company", "franchise", "freelancer", "staff"]);

export function PlatformViewBar({ portal }: { portal: string }) {
  const [isPlatform, setIsPlatform] = useState(false);
  const [actingAs, setActingAs] = useState(false);

  useEffect(() => {
    getMe().then((m) => setIsPlatform(m.role === "platform")).catch(() => {});
  }, []);
  useEffect(() => {
    const sync = () => setActingAs(!!getActAs());
    sync();
    window.addEventListener("aos:actas", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("aos:actas", sync); window.removeEventListener("storage", sync); };
  }, []);

  if (!isPlatform || actingAs || !TENANT_PORTALS.has(portal)) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#8a1c1c] px-4 py-2 text-center text-[12.5px] font-bold text-white">
      <span>⚠️ <b className="font-extrabold">Platform admin view</b> — showing data merged across every tenant, not scoped to one provider. Real business &amp; family data below, with no tenant labels.</span>
    </div>
  );
}
