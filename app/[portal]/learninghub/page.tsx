import { createElement } from "react";
import { notFound } from "next/navigation";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { getRegisteredView } from "@/lib/view-registry";
import { ViewGate } from "@/components/auth/ViewGate";

// Level 1 (Family home / tutor Teaching Hub): a literal folder here takes
// priority over app/[portal]/[view]/page.tsx for exactly this path, so the
// same URL that always worked (/[portal]/learninghub) keeps working — this
// file exists only so app/[portal]/learninghub/[childId]/… (Level 2/3) can
// nest under the SAME [portal] layout (auth, PortalGuard, chrome) instead of
// living in a route Next.js would treat as a sibling of the whole portal.
export default async function LearningHubPage(props: PageProps<"/[portal]/learninghub">) {
  const { portal } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;
  const registeredView = getRegisteredView(portalKey, "learninghub");
  if (!registeredView) notFound();
  return (
    <div className="p-3 sm:p-5">
      <ViewGate portal={portalKey} view="learninghub">{createElement(registeredView)}</ViewGate>
    </div>
  );
}
