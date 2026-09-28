import { notFound } from "next/navigation";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { ViewGate } from "@/components/auth/ViewGate";
import { StudentLearningHubDeep } from "@/features/learninghub/LearningHubApp";

// Level 2 (child space): a real, bookmarkable, refreshable URL for one child's
// Learning Hub. Only meaningful for the parent portal — a tutor never has a
// per-child route (they pick a student inside each panel instead).
export default async function LearningHubChildPage(props: PageProps<"/[portal]/learninghub/[childId]">) {
  const { portal, childId } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;
  if (portalKey !== "custdash") notFound();
  return (
    <div className="p-3 sm:p-5">
      <ViewGate portal={portalKey} view="learninghub">
        {/* No `key={childId}` here on purpose: that would force a full remount on every sibling switch, which
            resets useHubData's provider-fetch state too (a fresh mount briefly re-fetches GET /providers, and the
            in-between render can read as "genuinely switched off" rather than "still loading" — a real bug hit
            live: the child switcher's chips flashed "None of your providers have switched on the Learning Hub"
            for an instant before landing on the right page). Only the CHILD needs to re-derive on a plain sibling
            switch — useHubData.ts does that itself now (an effect that re-seeds childId when `initialChildId`
            changes), with no need to blow away and refetch the whole provider list. */}
        <StudentLearningHubDeep childId={decodeURIComponent(childId)} />
      </ViewGate>
    </div>
  );
}
