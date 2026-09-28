import { notFound } from "next/navigation";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { ViewGate } from "@/components/auth/ViewGate";
import { StudentLearningHubDeep } from "@/features/learninghub/LearningHubApp";

// Level 3 (one lesson): opens the hub already on Lessons, focused on this item.
export default async function LessonItemPage(props: PageProps<"/[portal]/learninghub/[childId]/lesson/[id]">) {
  const { portal, childId, id } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;
  if (portalKey !== "custdash") notFound();
  const child = decodeURIComponent(childId);
  return (
    <div className="p-3 sm:p-5">
      <ViewGate portal={portalKey} view="learninghub">
        <StudentLearningHubDeep childId={child} initialTab="notes" initialOpen={{ kind: "lesson", id: decodeURIComponent(id) }}
          backHref={`/${portalKey}/learninghub/${encodeURIComponent(child)}`} />
      </ViewGate>
    </div>
  );
}
