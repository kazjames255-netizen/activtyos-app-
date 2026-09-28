import { notFound } from "next/navigation";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { ViewGate } from "@/components/auth/ViewGate";
import { StudentLearningHubDeep } from "@/features/learninghub/LearningHubApp";

// Level 3 (flashcards): opens the hub already on Flashcards. The deck itself
// is due-based (one running set per child, not id-addressable decks yet), so
// this route names the child, not a deck — see live/[id]/page.tsx for the
// same limitation on live lessons.
export default async function FlashcardsPage(props: PageProps<"/[portal]/learninghub/[childId]/flashcards">) {
  const { portal, childId } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;
  if (portalKey !== "custdash") notFound();
  const child = decodeURIComponent(childId);
  return (
    <div className="p-3 sm:p-5">
      <ViewGate portal={portalKey} view="learninghub">
        <StudentLearningHubDeep childId={child} initialTab="flashcards" backHref={`/${portalKey}/learninghub/${encodeURIComponent(child)}`} />
      </ViewGate>
    </div>
  );
}
