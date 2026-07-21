import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { RequireAuth } from "@/components/auth/AuthProvider";
import { PortalGuard } from "@/components/auth/PortalGuard";

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
  const light = portalKey === "custdash";

  return (
    <RequireAuth>
      <PortalGuard portal={portalKey}>
        <div className="flex h-screen">
          <Sidebar portal={portalKey} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header portal={portalKey} />
            <main className="min-h-0 flex-1 overflow-auto bg-[var(--bg)] text-[var(--ink)]" style={light ? LIGHT_PALETTE : undefined}>{props.children}</main>
          </div>
        </div>
      </PortalGuard>
    </RequireAuth>
  );
}
