"use client";

import { TourLauncher } from "./TourLauncher";
import { TOUR_STEPS } from "./tourSteps";
import { TOUR_FIXTURES } from "./tourFixtures";
import { TOUR_CONFIGS } from "./tourConfigs";

// Pages that render their own "How it works" launcher inside the page — skip the
// central injection for them so it isn't shown twice.
const SELF_HOSTED = new Set(["customers", "ratios", "newsfeed", "tasks", "bookings", "messages"]);

// Drops the "How it works ▸ Watch walkthrough" launcher button at the top of a
// provider page. Clicking it opens the walkthrough in a popup (see
// TourLauncher). Renders nothing when the view has no tour at all.
export function PageTour({ view }: { view: string }) {
  const hasTour = (!!TOUR_STEPS[view] && !!TOUR_FIXTURES[view]) || !!TOUR_CONFIGS[view];
  if (!hasTour || SELF_HOSTED.has(view)) return null;
  return (
    <div className="mb-3">
      <TourLauncher view={view} />
    </div>
  );
}
