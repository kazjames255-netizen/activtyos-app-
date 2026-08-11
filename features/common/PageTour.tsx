"use client";

import { HowItWorks } from "@/components/HowItWorks";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { GuidedTour } from "./GuidedTour";
import { LiveTour } from "./LiveTour";
import { TOUR_CONFIGS } from "./tourConfigs";
import { TOUR_STEPS } from "./tourSteps";
import { TOUR_FIXTURES } from "./tourFixtures";

// Pages that render their own "How it works" panel and host the walkthrough
// there (in-context, under their banner) — skip the central injection for them
// so it isn't shown twice.
const SELF_HOSTED = new Set(["customers", "ratios", "newsfeed", "tasks", "bookings", "messages"]);

// Drops the "How it works ▸ walkthrough" panel at the top of a provider page.
// When a view has BOTH live steps and demo fixtures it plays the high-fidelity
// LiveTour (an iframe of the real page, narrated) — otherwise it falls back to
// the mock-frame GuidedTour until that page's fixtures land. Renders nothing
// when the view has no tour at all.
//
// The wrapper is a LIGHT band (LIGHT_PALETTE + --bg) that bleeds to the top and
// sides of the content area so the panel reads as part of the page instead of a
// lone card on the dark operator shell.
export function PageTour({ view, portal }: { view: string; portal: string }) {
  const hasLive = !!TOUR_STEPS[view] && !!TOUR_FIXTURES[view];
  const config = TOUR_CONFIGS[view];
  if ((!config && !hasLive) || SELF_HOSTED.has(view)) return null;
  const tour = hasLive ? (
    <LiveTour view={view} portal={portal} steps={TOUR_STEPS[view]} />
  ) : (
    <GuidedTour config={config} />
  );
  return (
    <div
      style={{ ...LIGHT_PALETTE, background: "var(--bg)" }}
      className="-mx-3 -mt-3 px-3 pb-3 pt-3 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pb-4 sm:pt-5 [&>details]:mb-0"
    >
      <HowItWorks tour={tour} />
    </div>
  );
}
