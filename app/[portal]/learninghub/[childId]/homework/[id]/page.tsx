import { notFound } from "next/navigation";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { ViewGate } from "@/components/auth/ViewGate";
import { StudentLearningHubDeep } from "@/features/learninghub/LearningHubApp";

// Level 3 (one piece of homework): opens the hub already on Homework, focused
// on this item, with a real URL — a notification / tutor message / email can
// link straight here instead of "see Homework and find it yourself".
export default async function HomeworkItemPage(props: PageProps<"/[portal]/learninghub/[childId]/homework/[id]">) {
  const { portal, childId, id } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;
  if (portalKey !== "custdash") notFound();
  const child = decodeURIComponent(childId);
  return (
    <div className="p-3 sm:p-5">
      <ViewGate portal={portalKey} view="learninghub">
        <StudentLearningHubDeep childId={child} initialTab="homework" initialOpen={{ kind: "hw", id: decodeURIComponent(id) }}
          backHref={`/${portalKey}/learninghub/${encodeURIComponent(child)}`} />
      </ViewGate>
    </div>
  );
}
