"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { get as apiGet, isDemoMode } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { findNavItem, type PortalKey } from "@/lib/nav/config";
import { capAreaForView, capLevel, featureKeysForView, firstOff } from "@/lib/accessMap";
import { getMe, peekMe } from "@/components/auth/PortalGuard";
import type { Me } from "@/lib/roles";
import { fetchCustomerArea, type CustomerArea } from "@/lib/use-customer-area";

// Family pages refused by URL when their provider has switched them off
// (Setup → Customer area, or the module in Features). The API refuses the
// data too (server/src/lib/customerArea.ts). Messages since 13 Sept (d7s7);
// the other family areas still refuse by data only (backlog s13-acc7).
const CUSTDASH_AREA: Record<string, keyof CustomerArea> = { messages: "messaging", learninghub: "learninghub" };
let customerAreaCache: CustomerArea | null = null;

// The per-VIEW gate (PortalGuard gates the portal). Before 13 Sept any
// registered view rendered for anyone in the portal: switching Meals off, or
// setting a staff role to None on an area, only hid the sidebar link — typing
// /company/meals loaded the whole screen (acceptance d2s2, d2s6). The API
// refuses the data regardless (server/src/middleware/access.ts); this says so
// plainly instead of a page full of errors. Same table: lib/accessMap.ts.

// Last-known Setup → Features for this session, so a revisited page decides
// synchronously. Refreshed on every mount + live on library changes.
let featuresCache: Record<string, boolean> | null = null;

export function ViewGate({ portal, view, children }: { portal: string; view: string; children: ReactNode }) {
  const keys = featureKeysForView(portal, view);
  const area = capAreaForView(portal, view);
  const caKey = portal === "custdash" ? CUSTDASH_AREA[view] : undefined;
  const gated = keys.length > 0 || !!area || !!caKey;
  const [features, setFeatures] = useState<Record<string, boolean> | null>(featuresCache);
  const [ca, setCa] = useState<CustomerArea | null>(customerAreaCache);
  const [me, setMe] = useState<Me | null>(() => peekMe());

  const load = useCallback(() => {
    if (!gated || isDemoMode()) return;
    if (caKey) {
      void fetchCustomerArea()
        .then((c) => { customerAreaCache = c; setCa(c); })
        .catch(() => setCa((c) => c ?? ({} as CustomerArea)));
      return;
    }
    void apiGet<{ settings?: { features?: Record<string, boolean> } } | null>("/api/library")
      .then((lib) => { featuresCache = { ...(lib?.settings?.features ?? {}) }; setFeatures(featuresCache); })
      // Unreadable → don't lock anyone out of the UI; the API still refuses. (An empty map would read an
      // OPT-IN module such as the Learning Hub as "turned off" — a misleading message on a slow API.)
      .catch(() => setFeatures((f) => f ?? Object.fromEntries(featureKeysForView(portal, view).map((k) => [k, true]))));
  }, [gated, caKey, portal, view]);
  useEffect(() => { load(); }, [load]);
  useRealtime(["library"], load);
  useEffect(() => { if (gated && !caKey) getMe().then(setMe).catch(() => {}); }, [gated, caKey]);

  if (!gated || isDemoMode()) return <>{children}</>;
  if (caKey) {
    if (ca === null) return <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-[var(--ink-3)]">Checking access…</div>;
    // A family opening a tutor's invite link has no enrolment yet, so the hub reads as "off" for them: let the claim screen through.
    const inviting = view === "learninghub" && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("invite");
    if ((!ca.simpleMode && ca[caKey] !== false) || inviting) return <>{children}</>;
    const caLabel = findNavItem(portal as PortalKey, view)?.label ?? "This area";
    return (
      <div className="mx-auto mt-6 max-w-[560px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink)]">
        <div className="text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{caLabel} isn&rsquo;t available</div>
        <p className="mt-1.5 text-[13px] leading-snug text-[var(--ink-2)]">
          Your provider has switched this off for families. To reach them, reply to one of their emails or use the contact details on your booking confirmation.
        </p>
      </div>
    );
  }
  // Only the switchable views wait for the answer (once per session).
  if (keys.length && features === null) {
    return <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-[var(--ink-3)]">Checking access…</div>;
  }
  const label = findNavItem(portal as PortalKey, view)?.label ?? "This area";
  const owner = me?.role === "company" || me?.role === "freelancer" || me?.role === "franchise";
  const off = firstOff(features, keys);
  const noAccess = !off && !!area && me?.role === "staff" && capLevel(me.caps, area) === "none";
  if (!off && !noAccess) return <>{children}</>;
  return (
    <div className="mx-auto mt-6 max-w-[560px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink)]">
      <div className="text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        {off ? `${label} is turned off` : `You don't have access to ${label}`}
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-[var(--ink-2)]">
        {off
          ? owner
            ? "It's switched off in Setup → Features, so it's hidden from your dashboard and your team. Turn it back on there to use it again — nothing in it has been deleted."
            : "Your provider has switched this area off. If you need it, ask a manager to turn it back on in Setup → Features."
          : "Your role doesn't include this area. If you need it, ask a manager — they can change what your role can see in Setup → Roles & permissions."}
      </p>
      {off && owner && (
        <Link href={`/${portal}/setup?tab=features`} className="mt-4 inline-block rounded-full bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-bold text-white">
          Open Setup → Features
        </Link>
      )}
    </div>
  );
}
