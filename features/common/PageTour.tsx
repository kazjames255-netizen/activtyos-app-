"use client";

import { HowItWorks } from "@/components/HowItWorks";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { GuidedTour } from "./GuidedTour";
import { TOUR_CONFIGS } from "./tourConfigs";

// Pages that render their own "How it works" panel and host the walkthrough
// there (in-context, under their banner) — skip the central injection for them
// so it isn't shown twice.
const SELF_HOSTED = new Set(["customers", "ratios", "newsfeed", "tasks", "bookings", "messages"]);

// Drops the "How it works ▸ walkthrough" panel at the top of a provider page
// when a guided tour exists for that view. Injected centrally by the portal
// route so pages with bespoke layouts (no shared hero, no HowItWorks) still get
// their walkthrough with no per-page wiring. Renders nothing when the view has
// no tour (Setup, Listings, Blocks carry their own).
//
// The wrapper is a LIGHT band (LIGHT_PALETTE + --bg) that bleeds to the top and
// sides of the content area — cancelling the portal route's p-3/p-5 padding —
// so the panel reads as part of the page instead of a lone card stranded on the
// dark operator shell. Bottom padding hosts the card; the page below (which
// bleeds up with its own negative margin) sits flush beneath it.
export function PageTour({ view }: { view: string }) {
  const config = TOUR_CONFIGS[view];
  if (!config || SELF_HOSTED.has(view)) return null;
  return (
    <div
      style={{ ...LIGHT_PALETTE, background: "var(--bg)" }}
      className="-mx-3 -mt-3 px-3 pb-3 pt-3 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pb-4 sm:pt-5 [&>details]:mb-0"
    >
      <HowItWorks tour={<GuidedTour config={config} />} />
    </div>
  );
}
