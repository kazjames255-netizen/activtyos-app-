import { notFound } from "next/navigation";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { ViewGate } from "@/components/auth/ViewGate";
import { StudentLearningHubDeep } from "@/features/learninghub/LearningHubApp";

// Level 3 (one live lesson): opens the hub already on Live lessons.
// NOTE: the live-lesson engine doesn't yet key a single lesson by id the way
// homework/quiz/lesson do (see features/learninghub/family/link.ts OpenKind) —
// this route lands on the Live tab, which itself surfaces the join/countdown
// for whichever lesson is current; wiring `id` to auto-select it is follow-up
// work, tracked rather than guessed at here.
export default async function LiveItemPage(props: PageProps<"/[portal]/learninghub/[childId]/live/[id]">) {
  const { portal, childId } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;
  if (portalKey !== "custdash") notFound();
  const child = decodeURIComponent(childId);
  return (
    <div className="p-3 sm:p-5">
      <ViewGate portal={portalKey} view="learninghub">
        <StudentLearningHubDeep childId={child} initialTab="live" backHref={`/${portalKey}/learninghub/${encodeURIComponent(child)}`} />
      </ViewGate>
    </div>
  );
}
