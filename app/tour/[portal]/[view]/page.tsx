"use client";

import { createElement, use, useState } from "react";
import { enableDemoMode } from "@/lib/api";
import type { PortalKey } from "@/lib/nav/config";
import { getRegisteredView } from "@/lib/view-registry";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { TOUR_FIXTURES } from "@/features/common/tourFixtures";
import { TourBridge } from "@/features/common/TourBridge";

// Renders a REAL provider-page component populated with demo fixtures, with no
// sidebar/header and no auth guard — this route lives outside the [portal]
// layout on purpose. The walkthrough embeds it in an iframe, so lib/api's demo
// mode is scoped to this document and never touches live pages. Flipping demo
// mode on happens in a useState initializer so it's set before the page
// component's data effects run.
export default function TourPage({ params }: { params: Promise<{ portal: string; view: string }> }) {
  const { portal, view } = use(params);
  useState(() => {
    enableDemoMode(TOUR_FIXTURES[view] ?? {});
    return null;
  });
  const View = getRegisteredView(portal as PortalKey, view);
  if (!View) return null;
  return (
    <div style={LIGHT_PALETTE} className="p-3 sm:p-5">
      <TourBridge />
      {createElement(View)}
    </div>
  );
}
