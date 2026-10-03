import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { ImpersonationBar } from "@/components/shell/ImpersonationBar";
import { PlatformViewBar } from "@/components/shell/PlatformViewBar";
import { RequireAuth } from "@/components/auth/AuthProvider";
import { PortalGuard } from "@/components/auth/PortalGuard";
import { SubscriptionGate, SubscriptionLock } from "@/components/auth/SubscriptionGate";
import { PageTracker } from "@/components/analytics/PageTracker";
import { CouponTicker } from "@/features/parent/CouponTicker";
import { NewsflashBanner } from "@/features/parent/NewsflashBanner";
import { ParentWelcome } from "@/features/parent/ParentWelcome";
import { StaffWelcome } from "@/features/staff/StaffWelcome";
import { StaffReminderBanner } from "@/features/staff/StaffReminderBanner";
import { HoThemeSync } from "@/components/franchise/HoScope";
import { ParentTabBar } from "@/components/shell/ParentTabBar";
import { ParentBrandTheme } from "@/components/shell/ParentBrandTheme";

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
        <PageTracker portal={portalKey} />
        <SubscriptionGate portal={portalKey}>
        <div className="aos-shell-root flex h-screen flex-col">
          {/* HQ impersonation bar — full width across the top when viewing-as.
              PlatformViewBar covers the OTHER case: a platform account
              previewing an operator portal WITHOUT impersonating anyone —
              the data routes still answer with every tenant's rows merged
              together, so say so just as loudly. The two are mutually
              exclusive. Neither is app content, so both are print:hidden —
              see item 67 in docs/amir-backend-outstanding.md. */}
          <div className="print:hidden"><ImpersonationBar /></div>
          <div className="print:hidden"><PlatformViewBar portal={portalKey} /></div>
          <div className="aos-shell-row flex min-h-0 flex-1">
          {/* Desktop-only rail; on mobile the Header's hamburger opens the same
              Sidebar as a slide-over drawer. Hidden outright when printing —
              it's navigation chrome, never part of a printed record. */}
          <div className="hidden flex-none print:hidden lg:block">
            <Sidebar portal={portalKey} />
          </div>
          {/* Light palette wraps the whole right column for custdash — the
              header included — so the parent shell is one continuous light
              surface rather than a dark header over a light body. */}
          <div className="flex min-w-0 flex-1 flex-col" style={light ? LIGHT_PALETTE : undefined}>
            {/* The top bar sits on the light surface in every portal — matching
                the customer app — instead of the near-black operator surface.
                print:hidden: the top nav has no place in a printed payslip,
                invoice, incident record or certificate. */}
            <div className="print:hidden" style={light ? undefined : LIGHT_PALETTE}>
              <Header portal={portalKey} />
              {portalKey === "company" && <HoThemeSync />}
            </div>
            {/* Paint the provider's brand accent over the parent portal + checkout. */}
            {portalKey === "custdash" && <ParentBrandTheme />}
            {/* First-login welcome popup (add-your-children), parent only, once. */}
            {portalKey === "custdash" && <ParentWelcome />}
            {/* First-login onboarding launcher for staff. */}
            {portalKey === "staff" && <StaffWelcome />}
            {/* Persistent, non-blocking reminder bar for staff — outstanding
                courses & documents, so first login isn't a wall of reading.
                print:hidden: a banner, not part of any printed record. */}
            {portalKey === "staff" && <div className="print:hidden"><StaffReminderBanner /></div>}
            {/* Customer-only flashy newsflash for unseen provider posts. print:hidden as above. */}
            {portalKey === "custdash" && <div className="print:hidden"><NewsflashBanner /></div>}
            {/* Customer-only running bar of the family's usable discount codes. print:hidden as above. */}
            {portalKey === "custdash" && <div className="print:hidden"><CouponTicker /></div>}
            {/* Operator trial / cancellation nudge bar — removed on request 2026-09-02;
                revisit where/how to reinstate it. Component kept at
                components/billing/TrialBanner.tsx. */}
            {/* The operator views each wrap themselves in the light palette, but
                the main surface itself must be light too — otherwise the dark
                --bg shows through as a black flash while a route loads. */}
            <main className={`aos-shell-main min-h-0 flex-1 overflow-auto bg-[var(--bg)] text-[var(--ink)]${portalKey === "custdash" ? " max-sm:pb-[calc(64px+env(safe-area-inset-bottom))]" : ""}`} style={light ? undefined : LIGHT_PALETTE}><SubscriptionLock portal={portalKey}>{props.children}</SubscriptionLock></main>
            {portalKey === "custdash" && <ParentTabBar />}
          </div>
          </div>
        </div>
        </SubscriptionGate>
      </PortalGuard>
    </RequireAuth>
  );
}
