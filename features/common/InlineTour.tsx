"use client";

import { usePathname } from "next/navigation";
import { GuidedTour } from "./GuidedTour";
import { LiveTour } from "./LiveTour";
import { TOUR_CONFIGS } from "./tourConfigs";
import { TOUR_STEPS } from "./tourSteps";
import { TOUR_FIXTURES } from "./tourFixtures";

// For pages that host the walkthrough inside their own "How it works" panel
// (Families, Ratios, Newsfeed, Tasks). Plays the high-fidelity LiveTour when the
// view has both steps and fixtures, else the mock GuidedTour. Portal is read
// from the URL so the iframe points at the right /tour route.
export function InlineTour({ view }: { view: string }) {
  const pathname = usePathname();
  const portal = pathname?.split("/")[1] || "freelancer";
  if (TOUR_STEPS[view] && TOUR_FIXTURES[view]) {
    return <LiveTour view={view} portal={portal} steps={TOUR_STEPS[view]} />;
  }
  return <GuidedTour config={TOUR_CONFIGS[view]} />;
}
