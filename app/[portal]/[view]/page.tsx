import { createElement } from "react";
import { notFound } from "next/navigation";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { getRegisteredView } from "@/lib/view-registry";

export default async function ViewPage(props: PageProps<"/[portal]/[view]">) {
  const { portal, view } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;

  // The prototype's mock sign-in views ("Log out" targets) are replaced by
  // real Firebase sign-out in the sidebar — never render them.
  if (view === "auth") notFound();

  // The registry is the source of truth for what's routable — it includes
  // aliases for old slugs that aren't in the sidebar, so links keep
  // working. The legacy prototype iframe fallback is gone: a slug with no
  // registered component 404s.
  const registeredView = getRegisteredView(portalKey, view);
  if (!registeredView) notFound();
  return (
    <div className="p-3 sm:p-5">
      {createElement(registeredView)}
    </div>
  );
}
