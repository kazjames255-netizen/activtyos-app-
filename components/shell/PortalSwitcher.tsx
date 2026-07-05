"use client";

import { useRouter } from "next/navigation";
import { PORTALS, PORTAL_LABELS, getDefaultView, type PortalKey } from "@/lib/nav/config";
import { Select } from "@/components/ui";

// No auth/gating yet (backend comes later) — this simply switches the active
// portal to its default view, mirroring the legacy prototype's portal
// switcher.
export function PortalSwitcher({ portal }: { portal: PortalKey }) {
  const router = useRouter();
  return (
    <Select
      value={portal}
      onChange={(e) => {
        const next = e.target.value as PortalKey;
        router.push(`/${next}/${getDefaultView(next)}`);
      }}
      className="!bg-[var(--surface)]"
    >
      {PORTALS.map((p) => (
        <option key={p} value={p}>
          {PORTAL_LABELS[p]}
        </option>
      ))}
    </Select>
  );
}
