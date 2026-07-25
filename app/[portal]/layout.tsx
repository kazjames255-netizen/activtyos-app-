import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { RequireAuth } from "@/components/auth/AuthProvider";
import { PortalGuard } from "@/components/auth/PortalGuard";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { CouponTicker } from "@/features/parent/CouponTicker";

// The customer dashboard runs the same light palette the operator screens sit
// on (see components/OperatorPage LIGHT_PALETTE), so the parent portal matches
// the freelancer area rather than the default dark shell.
const LIGHT_PALETTE = {
  "--bg": "#f5f8fd",
  "--surface": "#ffffff",
  "--panel": "#fbf8fc",
  "--ink": "#171534",
  "--ink-2": "#4a4763",
  "--ink-3": "#8a86a3",
  "--line": "#ece6f1",
} as CSSProperties;

export default async function PortalLayout(props: LayoutProps<"/[portal]">) {
  const { portal } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;
  // Customer + platform (HQ) portals run the full light palette (light header +
  // body), not the near-black operator shell.
  const light = portalKey === "custdash" || portalKey === "platform";

  return (
    <RequireAuth>
      <PortalGuard portal={portalKey}>
        <SubscriptionGate portal={portalKey}>
        <div className="flex h-screen">
          <Sidebar portal={portalKey} />
          {/* Light palette wraps the whole right column for custdash — the
              header included — so the parent shell is one continuous light
              surface rather than a dark header over a light body. */}
          <div className="flex min-w-0 flex-1 flex-col" style={light ? LIGHT_PALETTE : undefined}>
            {/* The top bar sits on the light surface in every portal — matching
                the customer app — instead of the near-black operator surface. */}
            <div style={light ? undefined : LIGHT_PALETTE}>
              <Header portal={portalKey} />
            </div>
            {/* Customer-only running bar of the family's usable discount codes. */}
            {portalKey === "custdash" && <CouponTicker />}
            {/* Operator trial / cancellation nudge bar. */}
            {!light && <TrialBanner portal={portalKey} />}
            <main className="min-h-0 flex-1 overflow-auto bg-[var(--bg)] text-[var(--ink)]">{props.children}</main>
          </div>
        </div>
        </SubscriptionGate>
      </PortalGuard>
    </RequireAuth>
  );
}
