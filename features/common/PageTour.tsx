"use client";

import { HowItWorks } from "@/components/HowItWorks";
import { GuidedTour } from "./GuidedTour";
import { TOUR_CONFIGS } from "./tourConfigs";

// Drops the "How it works ▸ walkthrough" panel at the top of a provider page
// when a guided tour exists for that view. Injected centrally by the portal
// route (app/[portal]/[view]/page.tsx) so every provider page gets its
// walkthrough from one place — no per-page wiring. Renders nothing when the
// view has no tour (e.g. Setup, or pages that carry their own bespoke tour
// like Listings and Blocks).
export function PageTour({ view }: { view: string }) {
  const config = TOUR_CONFIGS[view];
  if (!config) return null;
  return <HowItWorks tour={<GuidedTour config={config} />} />;
}
