"use client";

import { HowItWorks } from "@/components/HowItWorks";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { GuidedTour } from "./GuidedTour";
import { TOUR_CONFIGS } from "./tourConfigs";

// Pages that render their own "How it works" panel and host the walkthrough
// there (in-context, under their banner) — skip the central injection for them
// so it isn't shown twice.
const SELF_HOSTED = new Set(["customers", "ratios", "newsfeed", "tasks"]);

// Drops the "How it works ▸ walkthrough" panel at the top of a provider page
// when a guided tour exists for that view. Injected centrally by the portal
// route so pages with bespoke layouts (no shared hero, no HowItWorks) still get
// their walkthrough with no per-page wiring. The LIGHT_PALETTE wrapper is what
// keeps it looking like the Listings walkthrough — a light panel — instead of
// inheriting the dark operator shell it sits above. Renders nothing when the
// view has no tour (Setup, Listings, Blocks carry their own).
export function PageTour({ view }: { view: string }) {
  const config = TOUR_CONFIGS[view];
  if (!config || SELF_HOSTED.has(view)) return null;
  return (
    <div style={{ ...LIGHT_PALETTE, background: "transparent" }}>
      <HowItWorks tour={<GuidedTour config={config} />} />
    </div>
  );
}
