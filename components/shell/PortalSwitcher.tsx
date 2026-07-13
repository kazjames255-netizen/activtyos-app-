"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PORTALS, PORTAL_LABELS, getDefaultView, type PortalKey } from "@/lib/nav/config";
import { get as apiGet } from "@/lib/api";
import type { Me } from "@/lib/roles";
import { Select } from "@/components/ui";

// Cross-portal browsing is a super-admin tool: the Platform (HQ) owner can
// inspect every portal's UI, but for everyone else one account = one portal
// (the API scopes data by account anyway, so other portals would only show
// 403s). A prototype-era switcher used to be visible to all — now
// platform-only.
export function PortalSwitcher({ portal }: { portal: PortalKey }) {
  const router = useRouter();
  const [isPlatform, setIsPlatform] = useState(false);

  useEffect(() => {
    apiGet<Me>("/api/me")
      .then((me) => setIsPlatform(me.role === "platform"))
      .catch(() => setIsPlatform(false));
  }, []);

  if (!isPlatform) return null;

  return (
    <Select
      value={portal}
      onChange={(e) => {
        const next = e.target.value as PortalKey;
        router.push(`/${next}/${getDefaultView(next)}`);
      }}
      className="!bg-[var(--surface)]"
      title="Super-admin: preview any portal's UI"
    >
      {PORTALS.map((p) => (
        <option key={p} value={p}>
          {PORTAL_LABELS[p]}
        </option>
      ))}
    </Select>
  );
}
