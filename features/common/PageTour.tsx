"use client";

import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { TourLauncher } from "./TourLauncher";
import { TOUR_STEPS } from "./tourSteps";
import { TOUR_FIXTURES } from "./tourFixtures";
import { TOUR_CONFIGS } from "./tourConfigs";

// Pages that render their own "How it works" launcher inside the page — skip the
// central injection for them so it isn't shown twice.
const SELF_HOSTED = new Set(["customers", "ratios", "newsfeed", "tasks", "bookings", "messages", "listings", "blocks", "staff"]);

// Drops the "How it works ▸ Watch walkthrough" launcher button at the top of a
// provider page. Clicking it opens the walkthrough in a popup (see
// TourLauncher). Renders nothing when the view has no tour at all.
export function PageTour({ view }: { view: string }) {
  const hasTour = (!!TOUR_STEPS[view] && !!TOUR_FIXTURES[view]) || !!TOUR_CONFIGS[view];
  if (!hasTour || SELF_HOSTED.has(view)) return null;
  // Paint this strip with the page's own light palette, bleeding to the top and
  // sides so the launcher never floats on the dark operator shell (no black bar).
  return (
    <div
      style={{ ...LIGHT_PALETTE, background: "var(--bg)" }}
      className="-mx-3 -mt-3 mb-1 px-3 pb-3 pt-3 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pb-3 sm:pt-5"
    >
      <TourLauncher view={view} />
    </div>
  );
}
